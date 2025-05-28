"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/components/AuthProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import NotificationBell from "./NotificationBell";
import { 
  LogIn, 
  LogOut, 
  Loader2, 
  MessageSquare, 
  Plus,
  ChevronDown,
  ChevronUp,
  MessagesSquare,
  PenTool,
  LineChart,
  BrainCog,
  Search,
  Wrench,
  Trash2,
  FileText,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { TOOLS } from '@/lib/config/tools';
import { createNewThread } from '@/lib/utils/thread';
import { deleteThread } from '@/lib/utils/supabase';

// Map tool IDs to icons
const toolIcons = {
  'hybrid-offer': <FileText className="h-4 w-4 mr-2" />,
  'workshop-generator': <span className="mr-2">💻</span>
};

export default function Sidebar({ selectedTool, setSelectedTool, chats, setChats, currentChat, setCurrentChat, isLoading }) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [expandedChats, setExpandedChats] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const INITIAL_CHAT_COUNT = 5;

  const tools = Object.values(TOOLS);

  // Add this to debug the thread title issue
  useEffect(() => {
    if (currentChat) {
      if (process.env.NODE_ENV !== "production") console.log('[Sidebar] Current chat updated:', {
        chatId: currentChat.id,
        title: currentChat.title,
        messagesCount: currentChat.messages?.length || 0,
        firstMessage: currentChat.messages?.[0]?.content?.substring(0, 30)
      });
    }
  }, [currentChat]);

  // Close sidebar on mobile when navigating
  useEffect(() => {
    setIsMobileOpen(false);
  }, [currentChat]);

  const handleNewChat = (toolId = null) => {
    const newChat = createNewThread(toolId);
    if (process.env.NODE_ENV !== "production") console.log('[Sidebar] Created new chat object:', JSON.stringify(newChat));
    if (process.env.NODE_ENV !== "production") console.log(`[Sidebar] Attempting to set current chat. Tool ID passed: ${toolId}, New chat tool_id: ${newChat.tool_id}`);
    setCurrentChat(newChat);
  };

  const handleToolClick = (toolId) => {
    handleNewChat(toolId);
  };

  // Show all non-temporary chats regardless of the selected tool
  const filteredChats = chats.filter(chat => !chat.isTemporary);
  
  // Only show a limited number of chats unless expanded
  const visibleChats = expandedChats ? filteredChats : filteredChats.slice(0, INITIAL_CHAT_COUNT);
  const hasMoreChats = filteredChats.length > INITIAL_CHAT_COUNT;

  // Get chat tool icon based on tool_id
  const getChatIcon = (chat) => {
    if (!chat.tool_id) {
      return <MessagesSquare className="h-4 w-4 mr-2 text-muted-foreground" />;
    }
    
    return toolIcons[chat.tool_id] || <MessageSquare className="h-4 w-4 mr-2 text-muted-foreground" />;
  };

  // Delete chat handler
  const handleDeleteChat = async (chatId) => {
    try {
      if (process.env.NODE_ENV !== "production") console.log('[Sidebar] Attempting to delete chat:', chatId);
      await deleteThread(chatId);
      if (process.env.NODE_ENV !== "production") console.log('[Sidebar] Chat deleted successfully:', chatId);
      
      // Remove from UI state
      if (currentChat?.id === chatId) {
        setCurrentChat(null);
        setSelectedTool(null);
      }
      
      // Remove from chats list
      setChats(prev => prev.filter(chat => chat.id !== chatId));
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error('[Sidebar] Delete chat error:', err);
      alert('Failed to delete chat. Please try again.');
    }
  };

  // Mobile menu toggle button - fixed to top left
  const MobileMenuButton = () => (
    <div className="fixed top-4 left-4 z-50 md:hidden">
      <Button 
        variant="outline" 
        size="icon" 
        className="h-10 w-10 rounded-full bg-background shadow-lg border"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>
    </div>
  );

  return (
    <>
      <MobileMenuButton />
      
      <div className={`
        w-[300px] h-screen border-r flex flex-col bg-background fixed left-0 top-0 z-40
        transition-transform duration-300 ease-in-out
        md:translate-x-0 md:shadow-none
        ${isMobileOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'}
      `}>
        {/* Header with logo */}
        <div className="p-4 flex items-center justify-between border-b">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            <span className="font-semibold">Sovereign AI</span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell 
              chats={chats}
              setCurrentChat={setCurrentChat}
              currentChat={currentChat}
            />
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden"
              onClick={() => setIsMobileOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
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
            </div>
            <div className="space-y-1 ml-7">
              <div className="flex items-center justify-between mb-1">
                <Button
                  variant={!selectedTool ? "secondary" : "ghost"}
                  className="w-[85%] justify-start h-8 text-sm"
                  onClick={() => handleNewChat(null)}
                >
                  <MessagesSquare className="h-4 w-4 mr-2" />
                  JamesBot
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleNewChat(null)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {tools.map((tool) => (
                <div key={tool.id} className="flex items-center justify-between mb-1">
                  <Button
                    variant={selectedTool === tool.id ? "secondary" : "ghost"}
                    className="w-[85%] justify-start h-8 text-sm"
                    onClick={() => handleToolClick(tool.id)}
                  >
                    {toolIcons[tool.id] || <MessageSquare className="h-4 w-4 mr-2" />}
                    {tool.name}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToolClick(tool.id)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
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
            </div>
            
            <ScrollArea className="flex-1 h-full pr-4 overflow-visible hover:overflow-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-4 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-xs">Loading...</span>
                </div>
              ) : visibleChats.length > 0 ? (
                <div className="space-y-1 ml-7">
                  {visibleChats.map((chat) => (
                    <div key={chat.id} className="flex items-center mb-1">
                      <button 
                        className="mr-1 p-1 rounded hover:bg-red-100 text-red-600" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteChat(chat.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <Button
                        variant={currentChat?.id === chat.id ? "secondary" : "ghost"}
                        className="w-full justify-start px-2 h-8 text-sm hover:bg-muted"
                        onClick={() => {
                          setCurrentChat(chat);
                          setSelectedTool(chat.tool_id || null);
                        }}
                      >
                        {getChatIcon(chat)}
                        <span className="truncate">{chat.title}</span>
                      </Button>
                    </div>
                  ))}
                  
                  {hasMoreChats && (
                    <Button 
                      variant="ghost" 
                      className="w-full text-xs text-muted-foreground flex items-center justify-center mt-2"
                      onClick={() => setExpandedChats(!expandedChats)}
                    >
                      {expandedChats ? (
                        <>Show less <ChevronDown className="h-3 w-3 ml-1" /></>
                      ) : (
                        <>See more chats ({filteredChats.length - INITIAL_CHAT_COUNT}) <ChevronRight className="h-3 w-3 ml-1" /></>
                      )}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-center p-4 text-muted-foreground ml-7">
                  <p className="text-xs">No conversations yet</p>
                </div>
              )}
            </ScrollArea>
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
      
      {/* Overlay to close sidebar when clicking outside on mobile */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden" 
          onClick={() => setIsMobileOpen(false)}
        />
      )}
    </>
  );
} 