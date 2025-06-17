'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

export default function SnippetModal({ open, onOpenChange, message }) {
  const [snippets, setSnippets] = useState([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchSnippets();
    }
  }, [open]);

  const fetchSnippets = async () => {
    try {
      console.log('[SnippetModal] Fetching snippets...');
      const res = await fetch('/api/snippets');
      console.log('[SnippetModal] Fetch response status:', res.status);
      
      if (!res.ok) {
        const errorData = await res.text();
        console.error('[SnippetModal] Fetch error:', errorData);
        return;
      }
      
      const data = await res.json();
      console.log('[SnippetModal] Fetched snippets:', data);
      setSnippets(data.snippets || []);
    } catch (err) {
      console.error('[SnippetModal] Failed to load snippets:', err);
    }
  };

  const saveSnippet = async () => {
    if (!message) {
      console.error("Save snippet failed: message object is missing.");
      return;
    }
    
    // Ensure we have a thread_id - this should be set by the parent component
    if (!message.thread_id) {
      console.error("Save snippet failed: thread_id is missing from message object.", message);
      toast({
        title: "Failed to save snippet",
        description: "Unable to identify the conversation. Please try again.",
        variant: "destructive",
      });
      return;
    }
    
    console.log('[SnippetModal] Full message object:', message);
    console.log('[SnippetModal] Saving snippet with data:', {
      thread_id: message.thread_id,
      message_id: message.id,
      content: message.content?.substring(0, 100) + '...',
      note,
      hasThreadId: !!message.thread_id,
      hasMessageId: !!message.id,
      hasContent: !!message.content
    });
    
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

      console.log('[SnippetModal] API response status:', res.status);
      
      if (!res.ok) {
        const errorData = await res.text();
        console.error('[SnippetModal] API error response:', errorData);
        throw new Error(`Failed to save snippet: ${res.status} ${errorData}`);
      }

      const responseData = await res.json();
      console.log('[SnippetModal] Snippet saved successfully:', responseData);

      // Show success toast
      toast({
        title: "Snippet saved!",
        description: "Your message has been bookmarked successfully.",
        variant: "default",
      });

      setNote('');
      fetchSnippets(); // Refresh the list of snippets
      onOpenChange(false); // Close the modal on success
    } catch (err) {
      console.error('[SnippetModal] Failed to save snippet:', err);
      
      // Show error toast
      toast({
        title: "Failed to save snippet",
        description: "Please try again. If the problem persists, check your connection.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteSnippet = async (id) => {
    try {
      const res = await fetch(`/api/snippets/${id}`, { method: 'DELETE' });
      
      if (res.ok) {
        toast({
          title: "Snippet deleted",
          description: "The snippet has been removed from your bookmarks.",
          variant: "default",
        });
        fetchSnippets();
      } else {
        throw new Error('Failed to delete snippet');
      }
    } catch (err) {
      console.error('[SnippetModal] Failed to delete snippet:', err);
      toast({
        title: "Failed to delete snippet",
        description: "Please try again.",
        variant: "destructive",
      });
    }
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Snippets</DialogTitle>
          <DialogDescription>Bookmarked messages</DialogDescription>
        </DialogHeader>
        {message && (
          <div className="space-y-2 mb-4">
            <p className="text-sm border rounded p-2 max-h-40 overflow-auto whitespace-pre-wrap">{message.content}</p>
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
