"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import ChatArea from "./ChatArea";
import { useAuth } from "./AuthProvider";
import { getThreads } from "@/lib/utils/supabase";
import { useToast } from "@/hooks/use-toast";
import { FullPageLoading } from "./ui/loading";

// Helper function to check if an ID is a valid UUID
const isValidUUID = (id) => {
  if (!id) return false;
  const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidV4Pattern.test(id);
};

export default function ChatLayout() {
  const [selectedTool, setSelectedTool] = useState(null);
  const [chats, setChats] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  // Keep track of temporary to permanent ID mappings
  const [idMappings, setIdMappings] = useState({});

  // Use a more robust chat setter that handles ID changes
  const setCurrentChatWithTracking = (chat) => {
    console.log('[ChatLayout] Setting current chat:', {
      chatId: chat?.id,
      isValidUUID: chat?.id ? isValidUUID(chat.id) : false,
      messageCount: chat?.messages?.length
    });
    
    // Track if we're updating from temporary to permanent ID
    if (chat && currentChat && chat.id !== currentChat.id) {
      const prevIsTemp = currentChat.id && !isValidUUID(currentChat.id);
      const newIsValid = chat.id && isValidUUID(chat.id);
      
      if (prevIsTemp && newIsValid) {
        console.log('[ChatLayout] Tracking ID change:', { 
          from: currentChat.id, 
          to: chat.id 
        });
        setIdMappings(prev => ({...prev, [currentChat.id]: chat.id}));
      }
    }
    
    setCurrentChat(chat);
  };
  
  // Enhanced chats setter with deduplication and ID tracking
  const setChatsSafely = (newChatsOrUpdater) => {
    setChats(prevChats => {
      // Handle both direct value or updater function
      const updatedChats = typeof newChatsOrUpdater === 'function' 
        ? newChatsOrUpdater(prevChats) 
        : newChatsOrUpdater;
      
      // Deduplicate chats by ID (prefer newer version)
      const chatMap = new Map();
      
      // First add all chats to map (last one with same ID wins)
      updatedChats.forEach(chat => {
        chatMap.set(chat.id, chat);
      });
      
      const deduplicatedChats = Array.from(chatMap.values());
      
      // Log if we deduplicated anything
      if (deduplicatedChats.length !== updatedChats.length) {
        console.log('[ChatLayout] Deduplicated chats:', {
          before: updatedChats.length,
          after: deduplicatedChats.length
        });
      }
      
      return deduplicatedChats;
    });
  };

  // Redirect unauthenticated users to login page
  useEffect(() => {
    if (!authLoading && !user) {
      console.log('[ChatLayout] No authenticated user, redirecting to login page');
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  // Load threads from Supabase when the component mounts or user changes
  useEffect(() => {
    const loadThreads = async () => {
      if (!user?.id) {
        console.log('[ChatLayout] No user ID available, skipping thread loading');
        setIsLoading(false);
        return;
      }

      try {
        console.log('[ChatLayout] Loading threads for user:', user.id);
        setIsLoading(true);
        
        const threads = await getThreads(user.id);
        
        console.log('[ChatLayout] Threads loaded successfully:', {
          count: threads.length,
          threads: threads.map(t => ({
            id: t.id,
            title: t.title,
            messageCount: t.messages?.length || 0
          }))
        });
        
        // Set threads with isTemporary flag as false for database threads
        const formattedThreads = threads.map(thread => ({
          ...thread,
          isTemporary: false
        }));
        
        // Don't directly overwrite chats - use our safer setter
        setChatsSafely(formattedThreads);
        
        // Only set the current chat if NO chat is currently selected (neither existing nor temporary)
        if (!currentChat && formattedThreads.length > 0) {
          console.log('[ChatLayout] No chat selected, setting current chat to the first loaded thread:', formattedThreads[0].id);
          setCurrentChatWithTracking(formattedThreads[0]);
        } else {
          console.log('[ChatLayout] Keeping existing current chat:', currentChat?.id);
        }
      } catch (error) {
        console.error('[ChatLayout] Error loading threads:', error);
        toast({
          title: "Error",
          description: "Failed to load your conversations. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (user?.id) {
      loadThreads();
    }
  }, [user?.id, toast, currentChat]);

  // If still loading auth or no user, show loading or nothing
  if (authLoading) {
    return <FullPageLoading />;
  }
  
  if (!user) {
    return null; // Don't render anything while redirecting
  }

  return (
    <div className="flex h-screen w-full">
      <Sidebar 
        selectedTool={selectedTool}
        setSelectedTool={setSelectedTool}
        chats={chats}
        currentChat={currentChat}
        setCurrentChat={setCurrentChatWithTracking}
        isLoading={isLoading}
      />
      <div className="ml-[300px] flex-1 overflow-auto h-screen">
        <ChatArea 
          selectedTool={selectedTool}
          currentChat={currentChat}
          setCurrentChat={setCurrentChatWithTracking}
          chats={chats}
          setChats={setChatsSafely}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
} 