import { useState, useEffect, useCallback, useRef } from 'react';

export function useTextSelection(containerRef) {
  const [selectedText, setSelectedText] = useState('');
  const [selectionPosition, setSelectionPosition] = useState({ x: 0, y: 0 });
  const [isTextSelected, setIsTextSelected] = useState(false);
  const [selectionContext, setSelectionContext] = useState(null);

  const isTextSelectedRef = useRef(false);

  const clearSelection = useCallback(() => {
    setSelectedText('');
    setIsTextSelected(false);
    setSelectionPosition({ x: 0, y: 0 });
    setSelectionContext(null);
    isTextSelectedRef.current = false;
    
    // Clear the browser selection
    if (window.getSelection) {
      window.getSelection().removeAllRanges();
    }
  }, []);

  const getMessageContextFromNode = useCallback((node) => {
    let element = node;
    while (element && element.nodeType !== Node.ELEMENT_NODE) {
      element = element.parentNode;
    }
    
    while (element && !element.dataset?.messageId) {
      if (containerRef && containerRef.current && !containerRef.current.contains(element)) {
        return null;
      }
      element = element.parentElement;
    }
    
    if (element && element.dataset?.messageId) {
      return {
        messageId: element.dataset.messageId,
        chatId: element.dataset.chatId,
        messageRole: element.dataset.messageRole || 'assistant',
        sourceType: 'conversation'
      };
    }
    
    return null;
  }, [containerRef]);

  const handleSelection = useCallback((event) => {
    if (containerRef && containerRef.current && !containerRef.current.contains(event.target)) {
      if (isTextSelectedRef.current) {
        clearSelection();
      }
      return;
    }

    const selection = window.getSelection();
    const text = selection.toString().trim();
    
    if (text.length > 0) {
      const range = selection.getRangeAt(0);
      
      if (containerRef && containerRef.current && containerRef.current.contains(range.commonAncestorContainer)) {
        const rect = range.getBoundingClientRect();
        const context = getMessageContextFromNode(range.commonAncestorContainer);

        if (context) {
          setSelectedText(text);
          setSelectionPosition({
            x: rect.left + (rect.width / 2) - 120, // Center the menu
            y: rect.bottom + 8 // Position below selection
          });
          setSelectionContext(context);
          setIsTextSelected(true);
          isTextSelectedRef.current = true;
        }
      }
    } else if (isTextSelectedRef.current) {
      clearSelection();
    }
  }, [containerRef, getMessageContextFromNode, clearSelection]);

  const handleMouseUp = useCallback((event) => {
    // Small delay to ensure selection is complete
    setTimeout(() => {
      handleSelection(event);
    }, 10);
  }, [handleSelection]);

  const handleKeyUp = useCallback((event) => {
    // Handle keyboard selection (Shift + Arrow keys)
    if (event.shiftKey) {
      setTimeout(() => {
        handleSelection(event);
      }, 10);
    }
  }, [handleSelection]);

  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return;

    // Add event listeners to the container
    container.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('keyup', handleKeyUp);
    
    // Global click handler to clear selection when clicking outside
    const handleGlobalClick = (event) => {
      if (container && !container.contains(event.target)) {
        clearSelection();
      }
    };
    
    document.addEventListener('click', handleGlobalClick);

    return () => {
      container.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('click', handleGlobalClick);
    };
  }, [containerRef, handleMouseUp, handleKeyUp, clearSelection]);

  return {
    selectedText,
    selectionPosition,
    isTextSelected,
    selectionContext,
    clearSelection,
  };
} 