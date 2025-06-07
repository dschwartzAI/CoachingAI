"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bookmark, Plus } from 'lucide-react';
import { useAuth } from './AuthProvider';
import SnippetModal from './SnippetModal';
import { saveSnippet } from '@/lib/utils/snippets';
import { useToast } from '@/hooks/use-toast';

export default function SnippetButton({ 
  messageContent, 
  messageId, 
  chatId, 
  chatTitle,
  className = "" 
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleCreateSnippet = () => {
    if (!messageContent?.trim()) {
      toast({
        title: "Cannot Create Snippet",
        description: "This message has no content to save.",
        variant: "destructive"
      });
      return;
    }
    setIsModalOpen(true);
  };

  const handleSaveSnippet = async (snippetData) => {
    if (!user?.id) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to save snippets.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      // Prepare snippet data with chat context
      const snippetWithContext = {
        ...snippetData,
        sourceType: 'conversation',
        sourceId: chatId,
        messageId: messageId,
        sourceContext: JSON.stringify({
          chatId,
          chatTitle,
          messageId,
          sourceType: 'conversation'
        })
      };

      await saveSnippet(snippetWithContext, user.id);
      
      toast({
        title: "Snippet Saved",
        description: "Your snippet has been saved successfully.",
      });
      
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed to save snippet:', error);
      toast({
        title: "Error Saving Snippet",
        description: error.message || "Could not save your snippet.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCreateSnippet}
        className={`text-muted-foreground hover:text-foreground transition-colors ${className}`}
        title="Save as snippet"
      >
        <Bookmark className="h-4 w-4" />
      </Button>

      <SnippetModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveSnippet}
        selectedText={messageContent}
        sourceContext={{
          chatId,
          chatTitle,
          messageId,
          sourceType: 'conversation'
        }}
      />
    </>
  );
} 