"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function SnippetModal({
  isOpen,
  onClose,
  onSave,
  selectedText,
  existingSnippet = null,
  sourceContext = null
}) {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [tag, setTag] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [internalContent, setInternalContent] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (existingSnippet) {
        setTitle(existingSnippet.title || '');
        setNote(existingSnippet.note || '');
        setTag(existingSnippet.tag || '');
        setInternalContent(existingSnippet.content || '');
      } else {
        // Only set from selectedText if it's a new snippet AND selectedText is present
        if (selectedText) { 
          setInternalContent(selectedText);
          const defaultTitle = selectedText.split(' ').slice(0, 6).join(' ') +
                               (selectedText.split(' ').length > 6 ? '...' : '');
          setTitle(defaultTitle || '');
        } else {
          // If new snippet but selectedText is empty (e.g., after a save and clearSelection)
          // Reset to truly blank state for a potentially new highlight
          setInternalContent('');
          setTitle('');
        }
        setNote('');
        setTag('');
      }
    }
  }, [isOpen, existingSnippet, selectedText]);

  const handleSave = async () => {
    if (!title.trim()) {
      return;
    }

    setIsLoading(true);

    try {
      const snippetData = {
        title: title.trim(),
        content: internalContent,
        note: note.trim() || null,
        tag: tag.trim() || null,
        sourceType: sourceContext?.sourceType || 'conversation',
        sourceId: sourceContext?.chatId || null,
        sourceContext: sourceContext ? JSON.stringify(sourceContext) : null,
        messageId: sourceContext?.messageId || null,
      };

      if (existingSnippet) {
        snippetData.id = existingSnippet.id;
      }

      await onSave(snippetData);
      onClose();
    } catch (error) {
      console.error('Failed to save snippet:', error);
      // TODO: Add toast notification for error
    } finally {
      setIsLoading(false);
    }
  };

  const displayText = internalContent;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {existingSnippet ? 'Edit Snippet' : 'Save as Snippet'}
          </DialogTitle>
          <DialogDescription>
            {existingSnippet 
              ? 'Update your snippet details below.'
              : 'Add a title and optional note to save this text as a snippet.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Content Preview */}
          <div className="space-y-2">
            <Label htmlFor="content-preview">Content</Label>
            <div 
              id="content-preview"
              className="p-3 bg-muted rounded-md text-sm max-h-32 overflow-y-auto border"
            >
              {displayText}
            </div>
          </div>

          {/* Title Input */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title for this snippet"
              maxLength={100}
            />
          </div>

          {/* Note Input */}
          <div className="space-y-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add any additional notes or context"
              maxLength={500}
              rows={3}
            />
          </div>

          {/* Tag Input */}
          <div className="space-y-2">
            <Label htmlFor="tag">Tag (optional)</Label>
            <Input
              id="tag"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="e.g., business, strategy, ai"
              maxLength={50}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!title.trim() || isLoading}
          >
            {isLoading ? 'Saving...' : (existingSnippet ? 'Update' : 'Save Snippet')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 