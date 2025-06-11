"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import ChatArea from "@/components/ChatArea";
import { useChatStore } from "@/lib/stores/chat-store";
import { useAuth } from "@/components/AuthProvider";

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { chats, createNewChat, isInitialLoad } = useChatStore();
  
  useEffect(() => {
    // Redirect to login if not authenticated
    if (!authLoading && !user) {
      router.replace('/login');
      return;
    }
    
    // Once chats are loaded, redirect to most recent or create new
    if (!isInitialLoad && user) {
      if (chats.length > 0) {
        // Redirect to most recent chat
        router.replace(`/chat/${chats[0].id}`);
      } else {
        // Create a new chat
        const newChat = createNewChat();
        router.replace(`/chat/${newChat.id}`);
      }
    }
  }, [authLoading, user, chats, isInitialLoad, createNewChat, router]);
  
  // Show the chat area while deciding where to go
  return <ChatArea />;
}
