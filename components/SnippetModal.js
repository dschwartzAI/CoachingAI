'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export default function SnippetModal({ open, onOpenChange, message }) {
  const [snippets, setSnippets] = useState([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      fetchSnippets();
    }
  }, [open]);

  const fetchSnippets = async () => {
    try {
      const res = await fetch('/api/snippets');
      if (!res.ok) return;
      const data = await res.json();
      setSnippets(data.snippets || []);
    } catch (err) {
      console.error('Failed to load snippets:', err);
    }
  };

  const saveSnippet = async () => {
    if (!message) {
      console.error("Save snippet failed: message object is missing.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/snippets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thread_id: message.thread_id,
          message_id: message.id,
          content: message.content,
          note
        })
      });

      if (!res.ok) {
        throw new Error('Failed to save snippet');
      }

      setNote('');
      fetchSnippets(); // Refresh the list of snippets
      onOpenChange(false); // Close the modal on success
    } catch (err) {
      console.error('Failed to save snippet:', err);
    } finally {
      setSaving(false);
    }
  };

  const deleteSnippet = async (id) => {
    await fetch(`/api/snippets/${id}`, { method: 'DELETE' });
    fetchSnippets();
  };

  const handleSnippetClick = (snippet) => {
    console.log('[SnippetModal] Navigating to snippet:', { 
      threadId: snippet.thread_id, 
      messageId: snippet.message_id 
    });
    onOpenChange(false); // Close the modal
    router.push(`/chat/${snippet.thread_id}#message-${snippet.message_id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Snippets</DialogTitle>
          <DialogDescription>Bookmarked messages</DialogDescription>
        </DialogHeader>
        {message && (
          <div className="space-y-2 mb-4">
            <p className="text-sm border rounded p-2">{message.content}</p>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note (optional)"
              rows={2}
            />
            <Button onClick={saveSnippet} disabled={saving}>Save Snippet</Button>
          </div>
        )}
        <div className="space-y-2 max-h-60 overflow-auto border-t pt-2">
          {snippets.map(sn => (
            <div key={sn.id} className="flex items-start gap-2 text-sm">
              <button
                onClick={() => handleSnippetClick(sn)}
                className="flex-1 hover:underline text-left cursor-pointer hover:bg-muted p-2 rounded"
              >
                {sn.content.slice(0, 80)}
                {sn.note && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Note: {sn.note}
                  </div>
                )}
              </button>
              <Button size="icon" variant="ghost" onClick={() => deleteSnippet(sn.id)}>
                &times;
              </Button>
            </div>
          ))}
          {snippets.length === 0 && (
            <p className="text-sm text-muted-foreground">No snippets saved.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
