"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import ChatArea from "./ChatArea";
import { useAuth } from "./AuthProvider";
import { getThreads } from "@/lib/utils/supabase";
import { useToast } from "@/hooks/use-toast";
import { FullPageLoading } from "./ui/loading";

export default function ChatLayout() {
  const [selectedTool, setSelectedTool] = useState(null);
  const [chats, setChats] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

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
        
        // Set threads with isTemporary flag as false
        const formattedThreads = threads.map(thread => ({
          ...thread,
          isTemporary: false
        }));
        
        setChats(formattedThreads);
        
        // Set the first thread as the current chat if there's no current chat
        if (formattedThreads.length > 0 && !currentChat) {
          setCurrentChat(formattedThreads[0]);
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
        setCurrentChat={setCurrentChat}
        isLoading={isLoading}
      />
      <div className="ml-[300px] flex-1 overflow-auto h-screen">
        <ChatArea 
          selectedTool={selectedTool}
          currentChat={currentChat}
          setCurrentChat={setCurrentChat}
          chats={chats}
          setChats={setChats}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
} 