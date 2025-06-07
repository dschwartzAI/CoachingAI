"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Sidebar from "./Sidebar";
import ChatArea from "./ChatArea";
import ProfileModal from "./ProfileModal";
import { useAuth } from "./AuthProvider";
import { getThreads, getUserProfile, isProfileComplete } from "@/lib/utils/supabase";
import { useToast } from "@/hooks/use-toast";
import { FullPageLoading } from "./ui/loading";
import { createNewThread } from "@/lib/utils/thread";

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
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileComplete, setProfileComplete] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Keep track of temporary to permanent ID mappings
  const [idMappings, setIdMappings] = useState({});

  // Function to update URL with chat ID
  const updateURLWithChatId = (chatId) => {
    if (!chatId) {
      // Clear chatId from URL if no chat is selected
      router.replace('/', { scroll: false });
      return;
    }

    const currentChatId = searchParams.get('chatId');
    if (currentChatId !== chatId) {
      router.replace(`/?chatId=${chatId}`, { scroll: false });
    }
  };

  // Use a more robust chat setter that handles ID changes
  const setCurrentChatWithTracking = (chat) => {
    if (process.env.NODE_ENV !== "production") console.log('[ChatLayout] Setting current chat:', {
      chatId: chat?.id,
      isValidUUID: chat?.id ? isValidUUID(chat.id) : false,
      messageCount: chat?.messages?.length
    });
    
    // Track if we're updating from temporary to permanent ID
    if (chat && currentChat && chat.id !== currentChat.id) {
      const prevIsTemp = currentChat.id && !isValidUUID(currentChat.id);
      const newIsValid = chat.id && isValidUUID(chat.id);
      
      if (prevIsTemp && newIsValid) {
        if (process.env.NODE_ENV !== "production") console.log('[ChatLayout] Tracking ID change:', { 
          from: currentChat.id, 
          to: chat.id 
        });
        setIdMappings(prev => ({...prev, [currentChat.id]: chat.id}));
      }
    }
    
    setCurrentChat(chat);
    
    // Update URL with new chat ID
    updateURLWithChatId(chat?.id);
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
        if (process.env.NODE_ENV !== "production") console.log('[ChatLayout] Deduplicated chats:', {
          before: updatedChats.length,
          after: deduplicatedChats.length
        });
      }
      
      return deduplicatedChats;
    });
  };

  // Create default chat if needed
  const createDefaultChat = () => {
    if (process.env.NODE_ENV !== "production") console.log('[ChatLayout] Creating a default chat');
    const defaultChat = createNewThread(null); // Regular JamesBot chat
    defaultChat.isTemporary = false; // Make it persistent
    setChatsSafely([defaultChat]);
    setCurrentChatWithTracking(defaultChat);
    return defaultChat;
  };

  // Check profile completion status
  const checkProfileCompletion = async (userId) => {
    try {
      const profile = await getUserProfile(userId);
      const isComplete = isProfileComplete(profile);
      setProfileComplete(isComplete);
      setProfileChecked(true);
      
      // Show modal for first-time users or incomplete profiles
      if (!isComplete) {
        setShowProfileModal(true);
      }
      
      if (process.env.NODE_ENV !== "production") console.log('[ChatLayout] Profile completion check:', {
        userId,
        hasProfile: !!profile,
        isComplete,
        profile: profile ? { 
          full_name: profile.full_name, 
          occupation: !!profile.occupation,
          desired_mrr: !!profile.desired_mrr,
          desired_hours: !!profile.desired_hours
        } : null
      });
    } catch (error) {
      if (process.env.NODE_ENV !== "production") console.error('[ChatLayout] Error checking profile:', error);
      setProfileChecked(true);
      // Show modal if we can't check profile (likely new user)
      setShowProfileModal(true);
    }
  };

  // Redirect unauthenticated users to login page
  useEffect(() => {
    if (!authLoading && !user) {
      if (process.env.NODE_ENV !== "production") console.log('[ChatLayout] No authenticated user, redirecting to login page');
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  // Check profile completion when user loads
  useEffect(() => {
    if (user?.id && !profileChecked) {
      checkProfileCompletion(user.id);
    }
  }, [user?.id, profileChecked]);

  // Load threads from Supabase when the component mounts or user changes
  useEffect(() => {
    const loadThreads = async () => {
      if (!user?.id) {
        if (process.env.NODE_ENV !== "production") console.log('[ChatLayout] No user ID available, skipping thread loading');
        setIsLoading(false);
        
        // Create a default chat even if no user (for demo/anonymous mode)
        if (!currentChat) {
          createDefaultChat();
        }
        return;
      }

      try {
        if (process.env.NODE_ENV !== "production") console.log('[ChatLayout] Loading threads for user:', user.id);
        setIsLoading(true);
        
        const threads = await getThreads(user.id);
        
        if (process.env.NODE_ENV !== "production") console.log('[ChatLayout] Threads loaded successfully:', {
          count: threads.length,
          threads: threads.map(t => ({
            id: t.id,
            title: t.title,
            messageCount: t.messages?.length || 0,
            tool_id: t.tool_id,
            hasMetadata: !!t.metadata,
            questionsAnswered: t.metadata?.questionsAnswered || 0
          }))
        });

        // Format the threads to include message parsing
        const formattedThreads = threads.map(thread => {
          const parsedMessages = thread.messages ? 
            thread.messages.map(message => {
              let content = message.content;
              if (typeof content === 'string') {
                try {
                  const parsed = JSON.parse(content);
                  content = parsed;
                } catch (e) {
                  // If JSON parsing fails, keep content as is
                }
              }
              return { ...message, content };
            }) : [];

          return {
            ...thread,
            messages: parsedMessages
          };
        });

        // Preserve the new client-side chat if it doesn't exist in the database yet.
        // This prevents the new chat from being overwritten by the database load.
        let finalThreads = [...formattedThreads];
        const isNewChat = currentChat && !isValidUUID(currentChat.id);
        const newChatInDb = currentChat && formattedThreads.some(t => t.id === currentChat.id);

        if (isNewChat && !newChatInDb) {
          console.log('[ChatLayout] Preserving new client-side chat:', currentChat.id);
          finalThreads = [currentChat, ...formattedThreads];
        }

        setChatsSafely(finalThreads);
        
        // Set current chat based on URL parameter or history
        if (finalThreads.length > 0) {
          const urlChatId = searchParams.get('chatId');
          
          if (process.env.NODE_ENV !== "production") console.log('[ChatLayout] URL chatId parameter:', urlChatId);
          
          if (urlChatId) {
            // Try to find the chat specified in URL
            const targetChat = finalThreads.find(thread => thread.id === urlChatId);
            if (targetChat) {
              if (process.env.NODE_ENV !== "production") console.log('[ChatLayout] Setting current chat from URL parameter:', {
                id: targetChat.id,
                title: targetChat.title,
                tool_id: targetChat.tool_id
              });
              setCurrentChatWithTracking(targetChat);
            } else {
              if (process.env.NODE_ENV !== "production") console.log('[ChatLayout] Chat from URL not found, falling back to most recent:', {
                urlChatId,
                availableChats: finalThreads.map(t => t.id)
              });
              // URL chat not found, fall back to most recent
              const mostRecentRegularChat = finalThreads.find(thread => !thread.tool_id);
              const selectedChat = mostRecentRegularChat || finalThreads[0];
              setCurrentChatWithTracking(selectedChat);
            }
          } else if (!currentChat || !finalThreads.some(t => t.id === currentChat.id)) {
            // No current chat OR current chat is no longer in the list, select the most recent one
            const mostRecentRegularChat = finalThreads.find(thread => !thread.tool_id);
            const selectedChat = mostRecentRegularChat || finalThreads[0];
            
            if (process.env.NODE_ENV !== "production") console.log('[ChatLayout] No current chat, setting to most recent:', {
              id: selectedChat.id,
              title: selectedChat.title,
              tool_id: selectedChat.tool_id,
              isRegularChat: !selectedChat.tool_id,
              wasPrioritized: !!mostRecentRegularChat
            });
            setCurrentChatWithTracking(selectedChat);
          }
        } else {
          // No threads found, create a default chat
          if (process.env.NODE_ENV !== "production") console.log('[ChatLayout] No threads found, creating a default chat');
          createDefaultChat();
        }
      } catch (error) {
        if (process.env.NODE_ENV !== "production") console.error('[ChatLayout] Error loading threads:', error);
        toast({
          title: "Error",
          description: "Failed to load your conversations. Please try again.",
          variant: "destructive",
        });
        
        // Create a default chat when there's an error loading
        if (!currentChat) {
          createDefaultChat();
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (user?.id) {
      loadThreads();
    } else if (!isLoading && !currentChat) {
      // Create a default chat if we're not loading and don't have a current chat
      createDefaultChat();
    }
  }, [user?.id, searchParams, toast]);



  // New useEffect to synchronize selectedTool with currentChat.tool_id
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") console.log('[ChatLayout] useEffect for selectedTool sync triggered. currentChat:', currentChat ? { id: currentChat.id, tool_id: currentChat.tool_id, title: currentChat.title } : null);
    if (currentChat && currentChat.tool_id) {
      if (process.env.NODE_ENV !== "production") console.log(`[ChatLayout] Syncing selectedTool. Current: ${selectedTool}, New: ${currentChat.tool_id}`);
      setSelectedTool(currentChat.tool_id);
    } else if (currentChat && !currentChat.tool_id) {
      if (process.env.NODE_ENV !== "production") console.log(`[ChatLayout] Current chat has no tool_id. Current selectedTool: ${selectedTool}, Setting to null.`);
      setSelectedTool(null);
    } else if (!currentChat) {
      if (process.env.NODE_ENV !== "production") console.log(`[ChatLayout] No current chat. Current selectedTool: ${selectedTool}, Setting to null.`);
      setSelectedTool(null);
    }
  }, [currentChat]); // This effect runs when currentChat changes

  // Handle profile completion
  const handleProfileComplete = () => {
    setProfileComplete(true);
    toast({
      title: "Profile Complete!",
      description: "Your profile has been saved. We can now provide more personalized assistance.",
    });
  };

  // If still loading auth or no user, show loading or nothing
  if (authLoading) {
    return <FullPageLoading />;
  }
  
  if (!user) {
    return null; // Don't render anything while redirecting
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar 
        selectedTool={selectedTool}
        setSelectedTool={setSelectedTool}
        chats={chats}
        setChats={setChatsSafely}
        currentChat={currentChat}
        setCurrentChat={setCurrentChatWithTracking}
        isLoading={isLoading}
        onShowProfile={() => setShowProfileModal(true)}
        profileComplete={profileComplete}
      />
      <div className="w-full md:ml-[280px] flex-1 overflow-hidden h-screen transition-all duration-300">
        <ChatArea 
          selectedTool={selectedTool}
          currentChat={currentChat}
          setCurrentChat={setCurrentChatWithTracking}
          chats={chats}
          setChats={setChatsSafely}
          isLoading={isLoading}
        />
      </div>
      
      <ProfileModal
        open={showProfileModal}
        onOpenChange={setShowProfileModal}
        onProfileComplete={handleProfileComplete}
      />
    </div>
  );
} 