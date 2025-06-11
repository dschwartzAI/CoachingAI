import { useState, useCallback } from 'react';
import { useChatStore } from '@/lib/stores/chat-store';

export const useChatTitle = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const updateChatTitle = useChatStore(state => state.updateChatTitle);

  const generateTitle = useCallback(async (chatId, messages) => {
    if (messages.length < 3) return;
    const chat = useChatStore.getState().chats.find(c => c.id === chatId);
    if (chat?.hasCustomTitle) return;
    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages })
      });
      if (!response.ok) throw new Error('Failed to generate title');
      const { title } = await response.json();
      await updateChatTitle(chatId, title, false);
    } catch (error) {
      console.error('Title generation failed:', error);
      const fallbackTitle = `Chat ${new Date().toLocaleDateString()}`;
      await updateChatTitle(chatId, fallbackTitle, false);
    } finally {
      setIsGenerating(false);
    }
  }, [updateChatTitle]);

  return { generateTitle, isGenerating };
}; 