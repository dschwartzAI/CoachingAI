"use client";

import { useEffect, createContext, useContext } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import Sidebar from "./Sidebar";
import NotificationBell from "./NotificationBell";
import FeedbackButton from "./FeedbackButton";
import { useChatStore } from '@/lib/stores/chat-store';
import { FullPageLoading } from "./ui/loading";
import ProfileModal from "./ProfileModal";
import SnippetModal from "./SnippetModal";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

// Create context for bookmark functionality
const BookmarkContext = createContext();

export const useBookmark = () => {
  const context = useContext(BookmarkContext);
  if (!context) {
    // Return a no-op function for pages that don't have bookmark functionality
    return { onBookmark: () => {} };
  }
  return context;
};

export default function ChatLayoutWrapper({ children }) {
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSnippetModal, setShowSnippetModal] = useState(false);
  const [snippetMessage, setSnippetMessage] = useState(null);
  
  const {
    chats,
    currentChat,
    selectedTool,
    profileComplete,
    profileChecked,
    isInitialLoad,
    isSidebarLoading,
    isSidebarCollapsed,
    loadChats,
    setCurrentChat,
    setSelectedTool,
    createNewChat,
    deleteChat,
    checkProfileCompletion,
    setProfileComplete,
    reset
  } = useChatStore();

  // Check if we're on a page that should show the chat layout
  const shouldShowChatLayout = pathname === '/' || pathname.startsWith('/chat/');
  
  // Reset store when user logs out
  useEffect(() => {
    if (!authLoading && !user) {
      reset();
    }
  }, [user, authLoading, reset]);

  // Load chats when user is authenticated
  useEffect(() => {
    if (user?.id && isInitialLoad) {
      loadChats(user.id).catch(error => {
        toast({
          title: "Error",
          description: "Failed to load your conversations. Please try again.",
          variant: "destructive",
        });
      });
    }
  }, [user?.id, isInitialLoad, loadChats, toast]);

  // Check profile completion
  useEffect(() => {
    if (user?.id && !profileChecked) {
      checkProfileCompletion(user.id).then(({ isComplete }) => {
        if (!isComplete) {
          setShowProfileModal(true);
        }
      }).catch(error => {
        console.error('[ChatLayoutWrapper] Error checking profile:', error);
        setShowProfileModal(true);
      });
    }
  }, [user?.id, profileChecked, checkProfileCompletion]);

  // Handle profile completion
  const handleProfileComplete = () => {
    setProfileComplete(true);
    toast({
      title: "Profile Complete!",
      description: "Your profile has been saved. We can now provide more personalized assistance.",
    });
  };

  // Handle bookmark message
  const handleBookmarkMessage = (message) => {
    console.log('[ChatLayoutWrapper] Bookmark triggered with:', {
      messageId: message?.id,
      currentChatId: currentChat?.id,
      hasCurrentChat: !!currentChat
    });
    
    if (!currentChat?.id) {
      console.error('[ChatLayoutWrapper] Cannot bookmark: currentChat.id is missing');
      toast({
        title: "Failed to save snippet",
        description: "Unable to identify the current conversation. Please try again.",
        variant: "destructive",
      });
      return;
    }
    
    const messageWithThreadId = {
      ...message,
      thread_id: currentChat.id
    };
    
    console.log('[ChatLayoutWrapper] Setting snippet message with thread_id:', messageWithThreadId.thread_id);
    setSnippetMessage(messageWithThreadId);
    setShowSnippetModal(true);
  };

  // If not on a chat page, just render children without bookmark context
  if (!shouldShowChatLayout) {
    return children;
  }

  // Show loading while auth is loading
  if (authLoading) {
    return <FullPageLoading />;
  }

  // For chat pages, show the full layout with bookmark context
  return (
    <BookmarkContext.Provider value={{ onBookmark: handleBookmarkMessage }}>
      <div className="flex h-screen w-full overflow-hidden">
        <Sidebar
          selectedTool={selectedTool}
          setSelectedTool={setSelectedTool}
          chats={chats}
          currentChat={currentChat}
          setCurrentChat={setCurrentChat}
          createNewChat={createNewChat}
          deleteChat={deleteChat}
          isLoading={isSidebarLoading}
          onShowProfile={() => setShowProfileModal(true)}
          profileComplete={profileComplete}
        />
        <div className={`w-full ${isSidebarCollapsed ? 'md:ml-[60px]' : 'md:ml-[300px]'} flex-1 overflow-hidden h-screen transition-all duration-300`}>
          {children}
        </div>
        
        {/* Notification Bell and Feedback Button - Fixed in top right corner */}
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
          <FeedbackButton />
          <NotificationBell />
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
    </BookmarkContext.Provider>
  );
}