"use client";

import { Bookmark, Copy, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function TextSelectionMenu({ 
  position, 
  onSaveSnippet, 
  onCopy, 
  onShare,
  selectedText,
  menuRef 
}) {
  if (!selectedText) {
    return null;
  }

  const handleCopy = async () => {
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(selectedText);
        if (onCopy) onCopy();
      } catch (err) {
        console.error('Failed to copy text:', err);
      }
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = selectedText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      if (onCopy) onCopy();
    }
  };

  return (
    <Card
      ref={menuRef}
      className="fixed z-50 p-2 shadow-lg border bg-background"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        maxWidth: '240px'
      }}
    >
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onSaveSnippet}
          className="flex items-center gap-2 text-xs"
        >
          <Bookmark className="h-3 w-3" />
          Save as Snippet
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="flex items-center gap-2 text-xs"
        >
          <Copy className="h-3 w-3" />
          Copy
        </Button>
        
        {onShare && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onShare}
            className="flex items-center gap-2 text-xs"
          >
            <Share className="h-3 w-3" />
            Share
          </Button>
        )}
      </div>
    </Card>
  );
} 