'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/components/AuthProvider";
import { initializeThread, saveMessage, subscribeToThread } from '@/lib/utils/supabase';
import { getAIResponse } from '@/lib/utils/ai';
import { useToast } from '@/components/ui/use-toast';
import { TOOLS } from '@/lib/config/tools';
import { ToolProgress } from '@/components/ToolProgress';
import { Loader2 } from 'lucide-react';
import Message from '@/components/Message';

export default function Chat({ thread: initialThread, onThreadUpdate }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [thread, setThread] = useState(initialThread);
  const [messages, setMessages] = useState(thread?.messages || []);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const tool = thread?.tool_id ? TOOLS[thread.tool_id] : null;
  const [hasAttemptedInit, setHasAttemptedInit] = useState(false);

  // Update local thread state when prop changes
  useEffect(() => {
    console.log('[Chat] Thread prop updated:', {
      threadId: initialThread?.id,
      toolId: initialThread?.tool_id,
      messagesCount: initialThread?.messages?.length
    });
    setThread(initialThread);
    setMessages(initialThread?.messages || []);
  }, [initialThread]);

  // Handle initial tool message
  useEffect(() => {
    const currentTool = thread?.tool_id ? TOOLS[thread.tool_id] : null;
    const shouldInitiate =
      currentTool?.initiatesConversation &&
      !hasAttemptedInit &&
      (!messages || messages.length === 0);

    console.log('[Chat] Checking tool initialization:', {
      toolId: currentTool?.id,
      hasAttemptedInit,
      threadMessages: messages?.length,
      shouldInitiate
    });

    if (shouldInitiate && thread?.id) {
      handleToolInit();
    }
  }, [thread?.id, thread?.tool_id, hasAttemptedInit, messages]);

  const handleToolInit = async () => {
    console.log('[Chat] Starting tool initialization', {
      threadId: thread?.id,
      toolId: tool?.id,
      isTemporary: thread?.isTemporary,
      messagesCount: messages.length
    });
    try {
      setHasAttemptedInit(true);
      setIsLoading(true);

      console.log('[Chat] Getting initial AI response');
      const aiResponse = await getAIResponse('', {
        ...thread,
        messages: messages
      });

      if (aiResponse.error) {
        console.error('[Chat] AI Response Error during init:', aiResponse.error);
        throw new Error(aiResponse.error);
      }

      console.log('[Chat] Received AI response:', {
        responseContent: aiResponse.content ? `${aiResponse.content.substring(0, 30)}...` : '(empty)'
      });

      console.log('[Chat] Saving assistant message');
      const savedMessage = await saveMessage({
        thread_id: thread.id,
        role: 'assistant',
        content: aiResponse.content
      });

      console.log('[Chat] Message saved:', { messageId: savedMessage.id });

      setMessages(prev => [...prev, savedMessage]);
      if (onThreadUpdate) {
        onThreadUpdate({...thread, messages: [...messages, savedMessage]});
      }

    } catch (error) {
      console.error('[Chat] Error in tool initialization:', error);
      toast({
        title: "Error",
        description: `Failed to start the conversation: ${error.message}`,
        variant: "destructive",
      });
      setError(error.message);
    } finally {
      setIsLoading(false);
      console.log('[Chat] Tool initialization completed');
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!thread?.id || thread?.isTemporary) return;

    const channel = subscribeToThread(thread.id, (payload) => {
      console.log('[Chat] Realtime message received:', payload);
      const newMessage = payload.new;
      setMessages(prev => {
        if (prev.some(msg => msg.id === newMessage.id)) {
          return prev;
        }
        return [...prev, newMessage];
      });
      if (onThreadUpdate) {
        onThreadUpdate({...thread, messages: [...messages, newMessage]});
      }
    });

    return () => {
      if (channel) {
        channel.unsubscribe();
        console.log('[Chat] Unsubscribed from realtime channel for thread:', thread.id);
      }
    };
  }, [thread?.id, thread?.isTemporary]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const userInput = inputRef.current.value.trim();
    if (!userInput || isLoading || !thread?.id) {
      console.log('[Chat] Submit prevented:', {
        hasInput: !!userInput,
        isLoading,
        hasThreadId: !!thread?.id
      });
      return;
    }

    console.log('[Chat] Submitting message:', {
      userInput: userInput.length > 30 ? userInput.substring(0, 30) + '...' : userInput,
      threadId: thread.id,
      toolId: thread.tool_id,
      messagesCount: messages.length
    });

    const userMessagePayload = {
      role: 'user',
      content: userInput,
      thread_id: thread.id
    };

    // Add temp ID for optimistic update
    const tempId = Date.now();
    setMessages(prev => [...prev, { ...userMessagePayload, id: tempId }]);
    inputRef.current.value = '';
    setIsLoading(true);
    setError(null);

    try {
      console.log('[Chat] Saving user message');
      const savedUserMessage = await saveMessage(userMessagePayload);
      console.log('[Chat] User message saved:', {
        messageId: savedUserMessage.id,
        content: savedUserMessage.content.substring(0, 30) + '...'
      });
      
      // Replace temp message with saved message
      setMessages(prev => prev.map(msg => msg.id === tempId ? savedUserMessage : msg));

      console.log('[Chat] Calling getAIResponse');
      const response = await getAIResponse(userInput, {
        ...thread,
        messages: [...messages.filter(msg => msg.id !== tempId), savedUserMessage]
      });
      console.log('[Chat] AI response received:', response);

      if (response.error) {
        console.error('[Chat] AI Response Error on submit:', response.error);
        throw new Error(response.error);
      }

      const assistantMessagePayload = {
        role: 'assistant',
        content: response.content,
        thread_id: thread.id
      };

      console.log('[Chat] Saving assistant message');
      const savedAssistantMessage = await saveMessage(assistantMessagePayload);
      console.log('[Chat] Assistant message saved:', {
        messageId: savedAssistantMessage.id,
        content: savedAssistantMessage.content.substring(0, 30) + '...'
      });
      
      setMessages(prev => [...prev, savedAssistantMessage]);

      if (onThreadUpdate) {
        console.log('[Chat] Notifying parent of thread update');
        onThreadUpdate({...thread, messages: [...messages, savedAssistantMessage]});
      }

    } catch (err) {
      console.error('[Chat] Error in handleSubmit:', err);
      setError(err.message);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to get AI response: ${err.message}`
      });
    } finally {
      setIsLoading(false);
      console.log('[Chat] Message submission completed');
    }
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {tool && <ToolProgress tool={tool} messages={messages} />}
      <ScrollArea className="flex-grow p-4">
        <div className="space-y-4">
          {messages.map((msg) => (
            <Message key={msg.id || msg.tempId || messages.indexOf(msg)} message={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <form onSubmit={handleSubmit} className="p-4 border-t bg-card">
        <div className="flex gap-4 items-center">
          <Textarea
            placeholder="Type your message..."
            className="flex-1 resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            ref={inputRef}
            disabled={isLoading || !thread?.id}
            rows={1}
          />
          <Button type="submit" disabled={isLoading || !thread?.id} size="icon">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 16.571V11.5a1 1 0 011-1h1.093l4 8a1 1 0 001.745-.994l-4-8a1 1 0 00-.745-.657V7.429a1 1 0 00-.831-.977l-5-1.428zM11 10.5v5.071l-4 1.143 6-12-2 4.571H11z" />
              </svg>
            )}
          </Button>
        </div>
        {error && <p className="text-red-500 text-xs mt-2">Error: {error}</p>}
      </form>
    </div>
  );
} 