"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import ChatArea from "./ChatArea";
import ProfileModal from "./ProfileModal";
import SnippetModal from "./SnippetModal";
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

export default function ChatLayout({ initialChatId } = {}) {
  const [selectedTool, setSelectedTool] = useState(null);
  const [chats, setChats] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [isNewChat, setIsNewChat] = useState(false);
  const [isCurrentChatToolInit, setIsCurrentChatToolInit] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSnippetModal, setShowSnippetModal] = useState(false);
  const [snippetMessage, setSnippetMessage] = useState(null);
  const [profileComplete, setProfileComplete] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();

  // Keep track of temporary to permanent ID mappings
  const [idMappings, setIdMappings] = useState({});

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
    defaultChat.isNewChat = true;
    setIsNewChat(true);
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
        
        const preservedChats = chats.filter(c => c.isNewChat || c.isCurrentChatToolInit);

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

        setChatsSafely([...preservedChats, ...formattedThreads]);
        
        // Set current chat based on history or create a new one
        if (formattedThreads.length > 0) {
          if (!currentChat) {
            if (process.env.NODE_ENV !== "production") console.log('[ChatLayout] Setting current chat to the first loaded thread:', formattedThreads[0].id);
            setCurrentChatWithTracking(formattedThreads[0]);
          } else {
            if (process.env.NODE_ENV !== "production") console.log('[ChatLayout] Keeping existing current chat:', currentChat?.id);
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
          removeDelay: 10000,
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
  }, [user?.id, toast]);

  // When chats are loaded, select chat based on initialChatId if provided
  useEffect(() => {
    if (initialChatId && chats.length > 0) {
      if (process.env.NODE_ENV !== "production") console.log('[ChatLayout] Attempting to set chat from initialChatId:', initialChatId);
      const found = chats.find(c => c.id === initialChatId);
      if (found && currentChat?.id !== found.id) {
        if (process.env.NODE_ENV !== "production") console.log('[ChatLayout] Found chat matching initialChatId, setting now...');
        setCurrentChatWithTracking(found);
        setSelectedTool(found.tool_id || null);
      } else {
        if (process.env.NODE_ENV !== "production") console.warn('[ChatLayout] Did not find chat matching initialChatId or it was already set.');
      }
    }
  }, [initialChatId, chats]);

  // Only redirect if we're not already on the correct path
  useEffect(() => {
    // Avoid redirecting if currentChat is not set or doesn't have a valid ID
    if (!currentChat?.id || !isValidUUID(currentChat.id)) {
      if (process.env.NODE_ENV !== "production" && currentChat?.id) {
        console.log(`[ChatLayout] Redirect prevented for non-UUID chat ID: ${currentChat.id}`);
      }
      return;
    }

    const targetPath = `/chat/${currentChat.id}`;
    if (pathname !== targetPath) {
      if (process.env.NODE_ENV !== "production") console.log(`[ChatLayout] Redirecting to ${targetPath} from ${pathname}`);
      router.replace(targetPath);
    }
  }, [currentChat?.id, pathname, router]);

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

  // Clear new chat/tool init flags once a valid ID is present
  useEffect(() => {
    if (currentChat && isValidUUID(currentChat.id)) {
      setIsNewChat(false);
      setIsCurrentChatToolInit(false);
    }
  }, [currentChat?.id]);

  // Handle profile completion
  const handleProfileComplete = () => {
    setProfileComplete(true);
    toast({
      title: "Profile Complete!",
      description: "Your profile has been saved. We can now provide more personalized assistance.",
    });
  };

  const handleBookmarkMessage = (message) => {
    // Add the thread_id from currentChat to the message
    const messageWithThreadId = {
      ...message,
      thread_id: currentChat?.id
    };
    setSnippetMessage(messageWithThreadId);
    setShowSnippetModal(true);
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
        setIsNewChat={setIsNewChat}
        setIsCurrentChatToolInit={setIsCurrentChatToolInit}
        isLoading={isLoading}
        onShowProfile={() => setShowProfileModal(true)}
        profileComplete={profileComplete}
      />
      <div className="w-full md:ml-[300px] flex-1 overflow-hidden h-screen transition-all duration-300">
        <ChatArea
          selectedTool={selectedTool}
          currentChat={currentChat}
          setCurrentChat={setCurrentChatWithTracking}
          chats={chats}
          setChats={setChatsSafely}
          isLoading={isLoading}
          onBookmark={handleBookmarkMessage}
        />
      </div>
      
      <ProfileModal
        open={showProfileModal}
        onOpenChange={setShowProfileModal}
        onProfileComplete={handleProfileComplete}
      />
      <SnippetModal
        open={showSnippetModal}
        onOpenChange={setShowSnippetModal}
        message={snippetMessage}
      />
    </div>
  );
}
