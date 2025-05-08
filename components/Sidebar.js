"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/components/AuthProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  LogIn, 
  LogOut, 
  Loader2, 
  MessageSquare, 
  Plus,
  Settings,
  ChevronDown,
  MessagesSquare,
  PenTool,
  LineChart,
  BrainCog,
  Search,
  Wrench,
  Users
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { TOOLS } from '@/lib/config/tools';
import { createNewThread } from '@/lib/utils/thread';

// Map tool IDs to icons
const toolIcons = {
  'hybrid-offer': <PenTool className="h-4 w-4 mr-2" />,
  'content-repurposer': <BrainCog className="h-4 w-4 mr-2" />,
  'analytics': <LineChart className="h-4 w-4 mr-2" />
};

export default function Sidebar({ selectedTool, setSelectedTool, chats, currentChat, setCurrentChat, isLoading }) {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const tools = Object.values(TOOLS);

  // Add this to debug the thread title issue
  useEffect(() => {
    if (currentChat) {
      console.log('[Sidebar] Current chat updated:', {
        chatId: currentChat.id,
        title: currentChat.title,
        messagesCount: currentChat.messages?.length || 0,
        firstMessage: currentChat.messages?.[0]?.content?.substring(0, 30)
      });
    }
  }, [currentChat]);

  const handleNewChat = (toolId = null) => {
    const newChat = createNewThread(toolId);
    console.log('[Sidebar] Created new chat object:', JSON.stringify(newChat));
    console.log(`[Sidebar] Attempting to set current chat. Tool ID passed: ${toolId}, New chat tool_id: ${newChat.tool_id}`);
    setCurrentChat(newChat);
  };

  const handleToolClick = (toolId) => {
    handleNewChat(toolId);
  };

  // Show all non-temporary chats regardless of the selected tool
  const filteredChats = chats.filter(chat => !chat.isTemporary);

  // Get chat tool icon based on tool_id
  const getChatIcon = (chat) => {
    if (!chat.tool_id) {
      return <MessagesSquare className="h-4 w-4 mr-2 text-muted-foreground" />;
    }
    
    return toolIcons[chat.tool_id] || <MessageSquare className="h-4 w-4 mr-2 text-muted-foreground" />;
  };

  return (
    <div className="w-[300px] h-screen border-r flex flex-col bg-background fixed left-0 top-0">
      {/* Header with logo */}
      <div className="p-4 flex items-center border-b">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          <span className="font-semibold">Coaching AI</span>
        </div>
        <div className="ml-auto flex items-center">
          <Search className="h-4 w-4 text-muted-foreground mr-2" />
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      
      <div className="flex-grow flex flex-col overflow-hidden">
        {/* Specialized Tools Section */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <Wrench className="h-5 w-5 mr-2 text-muted-foreground" />
              <h2 className="text-sm font-medium">Specialized Tools</h2>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleNewChat()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-1 ml-7">
            <Button
              variant={!selectedTool ? "ghost" : "ghost"}
              className="w-full justify-start h-8 text-sm"
              onClick={() => handleNewChat(null)}
            >
              <MessagesSquare className="h-4 w-4 mr-2" />
              Regular Chat
            </Button>
            {tools.map((tool) => (
              <Button
                key={tool.id}
                variant={selectedTool === tool.id ? "secondary" : "ghost"}
                className="w-full justify-start h-8 text-sm"
                onClick={() => handleToolClick(tool.id)}
              >
                {toolIcons[tool.id] || <MessageSquare className="h-4 w-4 mr-2" />}
                {tool.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Chats/Past Conversations Section */}
        <div className="p-4 flex flex-col overflow-hidden flex-1">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <MessagesSquare className="h-5 w-5 mr-2 text-muted-foreground" />
              <h2 className="text-sm font-medium">Chats</h2>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleNewChat(selectedTool)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-4 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-xs">Loading...</span>
              </div>
            ) : filteredChats.length > 0 ? (
              <div className="space-y-1 ml-7">
                {filteredChats.map((chat) => (
                  <Button
                    key={chat.id}
                    variant={currentChat?.id === chat.id ? "ghost" : "ghost"}
                    className={`w-full justify-start px-2 h-8 text-sm hover:bg-muted ${
                      currentChat?.id === chat.id ? "bg-muted" : ""
                    }`}
                    onClick={() => {
                      setCurrentChat(chat);
                      setSelectedTool(chat.tool_id || null);
                    }}
                    title={chat.title}
                  >
                    {getChatIcon(chat)}
                    <span className="truncate">{chat.title}</span>
                  </Button>
                ))}
              </div>
            ) : (
              <div className="text-center p-4 text-muted-foreground ml-7">
                <p className="text-xs">No conversations yet</p>
              </div>
            )}
          </ScrollArea>
          
          <Button 
            variant="ghost" 
            className="w-full justify-start mt-2 text-xs text-muted-foreground ml-7"
          >
            View all
          </Button>
        </div>
      </div>

      {/* User Profile - Styled like the image */}
      <div className="p-4 border-t mt-auto">
        {user ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <Avatar className="h-8 w-8 border">
                <AvatarImage src={user.user_metadata?.avatar_url} alt={user.email} />
                <AvatarFallback>{user.email?.[0].toUpperCase() || "JH"}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium truncate" title={user.email}>
                  {user.email?.split('@')[0].split('.')[0][0].toUpperCase() + user.email?.split('@')[0].split('.')[0].slice(1) || "John Doe"}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  {user.email || "example@example.com"}
                </span>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} title="Log Out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button className="w-full" onClick={() => router.push('/login')}>
            <LogIn className="mr-2 h-4 w-4" /> Login / Sign Up
          </Button>
        )}
      </div>
    </div>
  );
} 