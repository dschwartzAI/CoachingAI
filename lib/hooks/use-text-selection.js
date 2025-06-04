import { useState, useEffect, useCallback } from 'react';

export function useTextSelection(containerRef) {
  const [selectedText, setSelectedText] = useState('');
  const [selectionPosition, setSelectionPosition] = useState({ x: 0, y: 0 });
  const [isTextSelected, setIsTextSelected] = useState(false);
  const [selectionContext, setSelectionContext] = useState(null);

  const clearSelection = useCallback(() => {
    setSelectedText('');
    setIsTextSelected(false);
    setSelectionContext(null);
    if (window.getSelection) {
      if (window.getSelection().rangeCount > 0) {
        window.getSelection().removeAllRanges();
      }
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
      if (isTextSelected) {
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
            x: rect.left + window.scrollX,
            y: rect.top + window.scrollY + rect.height + 5
          });
          setSelectionContext(context);
          setIsTextSelected(true);
        } else {
          clearSelection();
        }
      } else {
        clearSelection();
      }
    } else {
      clearSelection();
    }
  }, [containerRef, clearSelection, isTextSelected, getMessageContextFromNode]);

  useEffect(() => {
    document.addEventListener('mouseup', handleSelection);
    
    const handleMouseDownClear = (event) => {
      if (isTextSelected) {
        if (containerRef && containerRef.current && !containerRef.current.contains(event.target)) {
            clearSelection();
            return;
        }
      }
    };
    
    return () => {
      document.removeEventListener('mouseup', handleSelection);
    };
  }, [handleSelection, isTextSelected, containerRef, clearSelection]);

  return {
    selectedText,
    selectionPosition,
    isTextSelected,
    selectionContext,
    clearSelection,
  };
} 