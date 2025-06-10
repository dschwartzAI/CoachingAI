"use client";

import { useEffect } from "react";
import ChatArea from "@/components/ChatArea";
import useChatStore from "@/lib/stores/chat-store";

export default function ChatPage({ params }) {
  const { setCurrentChat } = useChatStore();
  
  useEffect(() => {
    // When URL changes, update the current chat
    // This handles browser back/forward navigation
    const updateChat = async () => {
      const { id } = await params;
      if (id) {
        setCurrentChat(id);
      }
    };
    
    updateChat();
  }, [params, setCurrentChat]);
  
  // The actual chat UI is rendered here
  return <ChatArea />;
}
