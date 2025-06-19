import { useState, useCallback } from 'react';
import { useChatStore } from '@/lib/stores/chat-store';

export const useChatTitle = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const updateChatTitle = useChatStore(state => state.updateChatTitle);

  const generateTitle = useCallback(async (chatId, messages) => {
    // Need at least 2 messages (user + assistant) to generate a meaningful title
    if (!messages || messages.length < 2) {
      console.log('[useChatTitle] Not enough messages for title generation:', messages?.length || 0);
      return;
    }
    
    const chat = useChatStore.getState().chats.find(c => c.id === chatId);
    if (chat?.hasCustomTitle) {
      console.log('[useChatTitle] Chat already has custom title, skipping');
      return;
    }
    
    // Check if chat already has a meaningful title (not default)
    if (chat?.title && 
        !chat.title.startsWith('New ') && 
        !chat.title.startsWith('Chat ') &&
        chat.title !== 'New conversation' &&
        chat.title.length > 3) {
      console.log('[useChatTitle] Chat already has meaningful title:', chat.title);
      return;
    }
    
    if (isGenerating) {
      console.log('[useChatTitle] Title generation already in progress');
      return;
    }
    
    setIsGenerating(true);
    try {
      console.log('[useChatTitle] Generating title for chat:', chatId, 'with', messages.length, 'messages');
      
      // Filter out any non-standard messages and ensure we have valid content
      const validMessages = messages.filter(msg => 
        msg && 
        msg.role && 
        msg.content && 
        typeof msg.content === 'string' &&
        msg.content.trim().length > 0 &&
        (msg.role === 'user' || msg.role === 'assistant') &&
        !msg.is_thinking &&
        !msg.isTemporary
      );
      
      if (validMessages.length < 2) {
        console.log('[useChatTitle] Not enough valid messages after filtering:', validMessages.length);
        return;
      }
      
      const response = await fetch('/api/generate-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: validMessages })
      });
      
      if (!response.ok) {
        throw new Error(`Title generation failed: ${response.status}`);
      }
      
      const { title } = await response.json();
      
      if (title && title.trim().length > 0) {
        console.log('[useChatTitle] Generated title:', title, 'for chat:', chatId);
        await updateChatTitle(chatId, title.trim(), false); // false = not custom title
      } else {
        console.warn('[useChatTitle] Empty title received from API');
      }
    } catch (error) {
      console.error('[useChatTitle] Error generating title:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [updateChatTitle, isGenerating]);

  return { generateTitle, isGenerating };
}; 