'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/components/AuthProvider";
import { initializeThread, saveMessage, subscribeToThread } from '@/lib/utils/supabase';
import { getAIResponse } from '@/lib/utils/ai';
import { useToast } from '@/hooks/use-toast';
import { TOOLS } from '@/lib/config/tools';
import { ToolProgress } from '@/components/ToolProgress';
import { Loader2, SendHorizontal, Plus, RefreshCw, ChevronDown, RotateCcw, ArrowUp } from 'lucide-react';
import Message from '@/components/Message';
import LoadingMessage from '@/components/LoadingMessage';
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Add this function to render a message loading UI indicator
function MessageLoadingIndicator() {
  return (
    <div className="flex items-start gap-3 max-w-[85%] group relative py-2 self-start mr-auto animate-pulse">
      <div className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-full bg-primary/20">
        <Loader2 className="h-5 w-5 text-primary animate-spin" />
      </div>
      
      <div className="rounded-2xl p-4 text-sm bg-muted text-foreground rounded-tl-none min-w-[180px]">
        <div className="flex flex-col space-y-3">
          <div className="flex items-center space-x-2">
            <div className="h-2.5 w-16 bg-primary/30 rounded-full"></div>
            <div className="h-2.5 w-24 bg-primary/20 rounded-full"></div>
          </div>
          <div className="h-2.5 w-32 bg-primary/25 rounded-full"></div>
          <div className="h-2.5 w-20 bg-primary/15 rounded-full"></div>
        </div>
      </div>
    </div>
  );
}

export default function Chat({ thread: initialThread, onThreadUpdate }) {
  const { user, getSession } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResponseLoading, setIsResponseLoading] = useState(false); // Explicit state for AI response loading
  const [thread, setThread] = useState(initialThread);
  const [messages, setMessages] = useState(thread?.messages || []);
  const [collectedAnswers, setCollectedAnswers] = useState(thread?.collectedAnswers || {});
  const [currentQuestionKey, setCurrentQuestionKey] = useState(thread?.currentQuestionKey || null);
  const [questionsAnswered, setQuestionsAnswered] = useState(thread?.questionsAnswered || 0);
  const [error, setError] = useState(null);
  const [showRecentChats, setShowRecentChats] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const tool = thread?.tool_id ? TOOLS[thread.tool_id] : null;
  const [hasAttemptedInit, setHasAttemptedInit] = useState(false);
  const [isInitializingThread, setIsInitializingThread] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Check auth status on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (authChecked) return;
      
      // Get the current session directly to ensure we have the latest state
      const { data } = await getSession();
      const session = data?.session;
      
      if (process.env.NODE_ENV !== "production") console.log('[Chat] Auth check:', {
        hasSession: !!session,
        userId: session?.user?.id,
        userIdFromContext: user?.id,
        match: session?.user?.id === user?.id
      });
      
      setAuthChecked(true);
      
      // Alert if no session or user ID - this is critical for saving threads
      if (!session || !session.user?.id) {
        if (process.env.NODE_ENV !== "production") console.error('[Chat] CRITICAL: No authenticated session. Threads cannot be saved!');
        toast({
          title: "Authentication Warning",
          description: "You appear to be using the app without being logged in. Your chats may not be saved.",
          variant: "destructive",
          removeDelay: 10000,
        });
      }
    };
    
    checkAuth();
  }, [user, getSession, authChecked, toast]);

  // Update local thread state when prop changes
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") console.log('[Chat] Thread prop updated:', {
      threadId: initialThread?.id,
      toolId: initialThread?.tool_id,
      messagesCount: initialThread?.messages?.length,
      isTemporary: initialThread?.isTemporary,
      questionsAnswered: initialThread?.questionsAnswered
    });
    setThread(initialThread);
    setMessages(initialThread?.messages || []);
    setCollectedAnswers(initialThread?.collectedAnswers || {});
    setCurrentQuestionKey(initialThread?.currentQuestionKey || null);
    setQuestionsAnswered(initialThread?.questionsAnswered || 0);
  }, [initialThread]);

  // Handle initial tool message
  useEffect(() => {
    const currentTool = thread?.tool_id ? TOOLS[thread.tool_id] : null;
    const shouldInitiate =
      currentTool?.initiatesConversation &&
      !hasAttemptedInit &&
      (!messages || messages.length === 0);

    if (process.env.NODE_ENV !== "production") console.log('[Chat] Checking tool initialization:', {
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
    if (process.env.NODE_ENV !== "production") console.log('[Chat] Starting tool initialization', {
      threadId: thread?.id,
      toolId: tool?.id,
      isTemporary: thread?.isTemporary,
      messagesCount: messages.length
    });
    try {
      setHasAttemptedInit(true);
      setIsLoading(true);

      if (process.env.NODE_ENV !== "production") console.log('[Chat] Getting initial AI response');
      const aiResponse = await getAIResponse('', {
        ...thread,
        messages: messages
      }, user.id);

      if (aiResponse.error) {
        if (process.env.NODE_ENV !== "production") console.error('[Chat] AI Response Error during init:', aiResponse.error);
        throw new Error(aiResponse.error);
      }

      if (process.env.NODE_ENV !== "production") console.log('[Chat] Received AI response:', {
        responseContent: aiResponse.content ? `${aiResponse.content.substring(0, 30)}...` : '(empty)'
      });

      if (process.env.NODE_ENV !== "production") console.log('[Chat] Saving assistant message');
      const assistantMessagePayload = {
        thread_id: thread.id,
        role: 'assistant',
        content: aiResponse.content,
        timestamp: new Date().toISOString()
      };
      
      const savedMessage = await saveMessage(assistantMessagePayload, user.id);

      if (process.env.NODE_ENV !== "production") console.log('[Chat] Message saved:', { messageId: savedMessage.id });

      setMessages(prev => [...prev, savedMessage]);
      if (onThreadUpdate) {
        onThreadUpdate({...thread, messages: [...messages, savedMessage]});
      }

    } catch (error) {
      if (process.env.NODE_ENV !== "production") console.error('[Chat] Error in tool initialization:', error);
      toast({
        title: "Error",
        description: `Failed to start the conversation: ${error.message}`,
        variant: "destructive",
        removeDelay: 10000,
      });
      setError(error.message);
    } finally {
      setIsLoading(false);
      if (process.env.NODE_ENV !== "production") console.log('[Chat] Tool initialization completed');
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [messages]);

  // Add a separate effect to scroll when loading state changes
  useEffect(() => {
    if (isLoading) {
      if (process.env.NODE_ENV !== "production") console.log('[Chat] Loading state changed, scrolling to bottom');
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isLoading]);

  useEffect(() => {
    if (!thread?.id || thread?.isTemporary) {
      if (process.env.NODE_ENV !== "production") console.log('[Chat] Skipping subscription setup - no thread ID or thread is temporary', {
        threadId: thread?.id,
        isTemporary: thread?.isTemporary
      });
      return;
    }

    if (process.env.NODE_ENV !== "production") console.log('[Chat] Setting up thread subscription', { threadId: thread.id });
    const channel = subscribeToThread(thread.id, (payload) => {
      if (process.env.NODE_ENV !== "production") console.log('[Chat] Realtime message received:', payload);
      const newMessage = payload.new;
      setMessages(prev => {
        if (prev.some(msg => msg.id === newMessage.id)) {
          if (process.env.NODE_ENV !== "production") console.log('[Chat] Message already exists in state, skipping', { messageId: newMessage.id });
          return prev;
        }
        if (process.env.NODE_ENV !== "production") console.log('[Chat] Adding new message to state', { messageId: newMessage.id });
        return [...prev, newMessage];
      });
      if (onThreadUpdate) {
        if (process.env.NODE_ENV !== "production") console.log('[Chat] Notifying parent of thread update');
        onThreadUpdate({...thread, messages: [...messages, newMessage]});
      }
    });

    return () => {
      if (channel) {
        channel.unsubscribe();
        if (process.env.NODE_ENV !== "production") console.log('[Chat] Unsubscribed from realtime channel for thread:', thread.id);
      }
    };
  }, [thread?.id, thread?.isTemporary]);

  const initializeNewThread = async (userInput) => {
    if (process.env.NODE_ENV !== "production") console.log('[Chat] Initializing new thread for first message:', {
      userInput: userInput.length > 30 ? userInput.substring(0, 30) + '...' : userInput,
      userId: user?.id,
      toolId: thread?.tool_id
    });
    
    setIsInitializingThread(true);
    
    try {
      // Get the latest session first
      const { data } = await getSession();
      const userId = data?.session?.user?.id || user?.id;
      
      // Check for user ID
      if (!userId) {
        if (process.env.NODE_ENV !== "production") console.error('[Chat] Cannot initialize thread - no user ID!');
        throw new Error('User ID is missing - are you logged in?');
      }
      
      // For all threads (both tool-based and regular), we'll let initializeThread 
      // generate the title from the first message. Only if there's no first message,
      // we'll use the tool name as a fallback.
      const threadData = {
        title: null, // Will be generated from first message in initializeThread
        tool_id: thread?.tool_id
      };
      
      // Pass the complete userInput as the first message
      if (process.env.NODE_ENV !== "production") console.log('[Chat] Passing user input to initializeThread:', {
        inputLength: userInput.length,
        threadTitle: '(will be generated from message)',
        toolId: thread?.tool_id,
        expectedTitle: userInput.length > 30 ? userInput.substring(0, 30) + '...' : userInput
      });
      
      const newThread = await initializeThread(threadData, userInput, userId);
      
      // Verify that the thread title was set correctly
      if (process.env.NODE_ENV !== "production") console.log('[Chat] New thread initialized:', {
        threadId: newThread.id,
        title: newThread.title,
        expectedTitle: !thread?.tool_id ? (userInput.length > 30 ? userInput.substring(0, 30) + '...' : userInput) : threadData.title,
        titleMatches: !thread?.tool_id ? newThread.title.startsWith(userInput.substring(0, Math.min(10, userInput.length))) : newThread.title === threadData.title,
        messagesCount: newThread.messages?.length,
        firstMessage: newThread.messages?.[0]?.content
      });
      
      setThread(newThread);
      setMessages(newThread.messages || []);
      
      if (onThreadUpdate) {
        if (process.env.NODE_ENV !== "production") console.log('[Chat] Notifying parent of new thread');
        onThreadUpdate(newThread);
      }
      
      return newThread;
    } catch (error) {
      if (process.env.NODE_ENV !== "production") console.error('[Chat] Error initializing new thread:', error);
      toast({
        title: "Error",
        description: `Failed to start a new chat: ${error.message}`,
        variant: "destructive",
        removeDelay: 10000,
      });
      setError(error.message);
      return null;
    } finally {
      setIsInitializingThread(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const userInput = inputRef.current.value.trim();
    if (!userInput || isLoading || isResponseLoading) {
      if (process.env.NODE_ENV !== "production") console.log('[Chat] Submit prevented:', {
        hasInput: !!userInput,
        isLoading,
        isResponseLoading
      });
      return;
    }

    if (process.env.NODE_ENV !== "production") console.log('[Chat] Preparing to submit message:', {
      userInput: userInput.length > 30 ? userInput.substring(0, 30) + '...' : userInput,
      threadId: thread?.id,
      toolId: thread?.tool_id,
      messagesCount: messages.length,
      questionsAnswered: questionsAnswered,
      currentQuestionKey: currentQuestionKey
    });

    // Set loading state immediately for better visual feedback
    setIsLoading(true);
    setIsResponseLoading(true); // Set explicit response loading indicator

    // Handle the case where no thread exists yet
    let currentThread = thread;
    if (!currentThread?.id) {
      if (process.env.NODE_ENV !== "production") console.log('[Chat] No thread ID found, initializing new thread');
      currentThread = await initializeNewThread(userInput);
      if (!currentThread) {
        if (process.env.NODE_ENV !== "production") console.log('[Chat] Failed to initialize thread, aborting message submission');
        setIsLoading(false);
        setIsResponseLoading(false);
        return;
      }

      // At this point, the message has already been saved as part of thread initialization
      if (process.env.NODE_ENV !== "production") console.log('[Chat] User message already saved during thread initialization');
      inputRef.current.value = '';
      setError(null);

      // Need to get AI response for the first message
      try {
        if (process.env.NODE_ENV !== "production") console.log('[Chat] Getting AI response for first message');
        const response = await getAIResponse(userInput, {
          ...currentThread,
          messages: currentThread.messages
        }, user.id);
        
        if (response.error) {
          if (process.env.NODE_ENV !== "production") console.error('[Chat] AI Response Error for first message:', response.error);
          throw new Error(response.error);
        }
        
        const assistantMessagePayload = {
          role: 'assistant',
          content: response.content,
          thread_id: currentThread.id,
          timestamp: new Date().toISOString()
        };
        
        if (process.env.NODE_ENV !== "production") console.log('[Chat] Saving assistant message for first conversation turn');
        const savedAssistantMessage = await saveMessage(assistantMessagePayload, user.id);
        
        if (process.env.NODE_ENV !== "production") console.log('[Chat] Assistant message saved:', {
          messageId: savedAssistantMessage.id
        });
        
        setMessages(prev => [...prev, savedAssistantMessage]);
        
        if (onThreadUpdate) {
          if (process.env.NODE_ENV !== "production") console.log('[Chat] Notifying parent of thread update after first AI response');
          onThreadUpdate({...currentThread, messages: [...currentThread.messages, savedAssistantMessage]});
        }
      } catch (err) {
        if (process.env.NODE_ENV !== "production") console.error('[Chat] Error getting first AI response:', err);
        setError(err.message);
        toast({
          variant: "destructive",
          title: "Error",
          description: `Failed to get AI response: ${err.message}`,
          removeDelay: 10000,
        });
      } finally {
        setIsLoading(false);
        setIsResponseLoading(false);
      }
      
      return;
    }

    // Regular message flow for existing thread
    const timestamp = new Date().toISOString();
    const userMessagePayload = {
      role: 'user',
      content: userInput,
      thread_id: currentThread.id,
      timestamp
    };

    // Add temp ID for optimistic update
    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [...prev, { ...userMessagePayload, id: tempId }]);
    inputRef.current.value = '';
    setError(null);

    try {
      if (process.env.NODE_ENV !== "production") console.log('[Chat] Saving user message to existing thread');
      const savedUserMessage = await saveMessage(userMessagePayload, user.id);
      if (process.env.NODE_ENV !== "production") console.log('[Chat] User message saved:', {
        messageId: savedUserMessage.id,
        content: savedUserMessage.content.substring(0, 30) + '...'
      });
      
      // Replace temp message with saved message
      setMessages(prev => prev.map(msg => msg.id === tempId ? savedUserMessage : msg));

      if (process.env.NODE_ENV !== "production") console.log('[Chat] handleSubmit: Preparing to call getAIResponse. Thread ID:', currentThread?.id);
      if (!currentThread?.id) {
         if (process.env.NODE_ENV !== "production") console.error('[Chat] handleSubmit: CRITICAL - currentThread.id is missing before calling getAIResponse!');
      }
      
      // Make sure loading is still set to true before AI response
      setIsLoading(true);
      setIsResponseLoading(true);
      
      const response = await getAIResponse(userInput, {
        id: currentThread.id,
        ...currentThread,
        messages: [...messages.filter(msg => msg.id !== tempId), savedUserMessage],
        currentQuestionKey: currentQuestionKey,
        questionsAnswered: questionsAnswered,
        collectedAnswers: collectedAnswers
      }, user.id);

      if (response.error) {
        if (process.env.NODE_ENV !== "production") console.error('[Chat] AI Response Error on submit:', response.error);
        throw new Error(response.error);
      }

      const assistantTimestamp = new Date().toISOString();
      const assistantMessagePayload = {
        role: 'assistant',
        content: response.content,
        thread_id: currentThread.id,
        timestamp: assistantTimestamp
      };

      if (process.env.NODE_ENV !== "production") console.log('[Chat] Saving assistant message');
      const savedAssistantMessage = await saveMessage(assistantMessagePayload, user.id);
      if (process.env.NODE_ENV !== "production") console.log('[Chat] Assistant message saved:', {
        messageId: savedAssistantMessage.id,
        content: savedAssistantMessage.content.substring(0, 30) + '...'
      });
      
      // Update tool state if available
      if (response.currentQuestionKey !== undefined) {
        setCurrentQuestionKey(response.currentQuestionKey);
      }
      
      if (response.questionsAnswered !== undefined) {
        setQuestionsAnswered(response.questionsAnswered);
      }
      
      if (response.collectedAnswers) {
        setCollectedAnswers(response.collectedAnswers);
      }
      
      setMessages(prev => [...prev, savedAssistantMessage]);

      // Construct updated thread with tool data
      const updatedThread = {
        ...currentThread,
        messages: [...messages, savedAssistantMessage],
        currentQuestionKey: response.currentQuestionKey || currentQuestionKey,
        questionsAnswered: response.questionsAnswered || questionsAnswered,
        collectedAnswers: response.collectedAnswers || collectedAnswers,
        isComplete: response.isComplete || false
      };

      if (onThreadUpdate) {
        if (process.env.NODE_ENV !== "production") console.log('[Chat] Notifying parent of thread update with tool data:', {
          currentQuestionKey: updatedThread.currentQuestionKey,
          questionsAnswered: updatedThread.questionsAnswered,
          answersCount: Object.keys(updatedThread.collectedAnswers || {}).length
        });
        onThreadUpdate(updatedThread);
      }

    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error('[Chat] Error in handleSubmit:', err);
      setError(err.message);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to get AI response: ${err.message}`,
        removeDelay: 10000,
      });
    } finally {
      setIsLoading(false);
      setIsResponseLoading(false);
      if (process.env.NODE_ENV !== "production") console.log('[Chat] Message submission completed');
    }
  };

  const handleResetChat = () => {
    if (confirm("Are you sure you want to reset this chat? All messages will be cleared.")) {
      setMessages([]);
      setHasAttemptedInit(false);
      // If it's a tool conversation, this will trigger initialization again
    }
  };

  return (
    <Card className="flex flex-col h-full bg-background border-none">
      {thread?.id && (
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-semibold" title={thread.title}>
              {thread.title || "New Chat"}
            </h3>
            {tool && <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">{tool.name}</span>}
          </div>
          <div className="flex space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowRecentChats(!showRecentChats)}
              title="Recent chats"
              className="rounded-full h-8 w-8"
            >
              <ChevronDown className={cn("h-4 w-4", showRecentChats && "rotate-180")} />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleResetChat}
              title="Reset chat"
              className="rounded-full h-8 w-8"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      
      {tool && <ToolProgress tool={tool} messages={messages} thread={thread} />}
      
      <ScrollArea className="flex-grow p-6">
        <div className="flex flex-col-reverse space-y-reverse space-y-6 max-w-3xl mx-auto pt-32">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <RefreshCw className="h-8 w-8 mb-2 animate-spin-slow" />
              {tool ? 
                <p>Starting {tool.name}...</p> : 
                <h2 className="text-xl font-semibold">What can I help with?</h2>
              }
            </div>
          )}
          
          {messages
            .slice()
            .reverse()
            .map((msg, index, arr) => (
              <Message key={msg.id || msg.tempId || index} message={msg} />
            ))}
          
          {/* Use the new LoadingMessage component with explicit response loading state */}
          {isResponseLoading && <LoadingMessage />}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <CardContent className="p-4 border-t">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="relative">
            <Textarea
              placeholder="What can I help with?"
              className="flex-1 resize-none min-h-[60px] px-4 py-3 pr-12 rounded-2xl bg-muted border-0 focus-visible:ring-1 focus-visible:ring-primary"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              ref={inputRef}
              disabled={isLoading || isInitializingThread || isResponseLoading}
              rows={1}
            />
            <Button 
              type="submit" 
              disabled={isLoading || isInitializingThread || isResponseLoading} 
              size="icon" 
              className="absolute right-2 bottom-2 rounded-full h-8 w-8 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isLoading || isInitializingThread || isResponseLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </Button>
          </div>
          {error && <p className="text-red-500 text-xs mt-1">Error: {error}</p>}
        </form>
      </CardContent>
    </Card>
  );
} 