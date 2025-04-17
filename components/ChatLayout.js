"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import ChatArea from "./ChatArea";

export default function ChatLayout() {
  const [selectedTool, setSelectedTool] = useState("hybrid-offer");
  const [chats, setChats] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);

  return (
    <>
      <Sidebar 
        selectedTool={selectedTool}
        setSelectedTool={setSelectedTool}
        chats={chats}
        currentChat={currentChat}
        setCurrentChat={setCurrentChat}
      />
      <ChatArea 
        selectedTool={selectedTool}
        currentChat={currentChat}
        setCurrentChat={setCurrentChat}
        chats={chats}
        setChats={setChats}
      />
    </>
  );
} 