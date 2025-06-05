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
  X,
  Settings,
  User,
  CheckCircle2,
  AlertCircle,
  Bell,
  Bookmark
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { TOOLS } from '@/lib/config/tools';
import { createNewThread } from '@/lib/utils/thread';
import { deleteThread } from '@/lib/utils/supabase';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import SnippetsModal from './SnippetsModal';

// Tool icons mapping
const toolIcons = {
  'hybrid-offer': BrainCog,
  'workshop-generator': PenTool
};

export default function Sidebar({ selectedTool, setSelectedTool, chats, setChats, currentChat, setCurrentChat, isLoading, onShowProfile, profileComplete }) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [expandedChats, setExpandedChats] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const INITIAL_CHAT_COUNT = 6;
  const [isSnippetsModalOpen, setIsSnippetsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Touch gesture states for swipe to close
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  const tools = Object.entries(TOOLS).map(([id, tool]) => ({
    id,
    ...tool
  }));

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

  // Close sidebar on mobile when navigating
  useEffect(() => {
    setIsMobileOpen(false);
  }, [currentChat]);

  useEffect(() => {
    // Lock body scroll when sidebar is open on mobile
    if (typeof window !== 'undefined') {
      document.body.style.overflow = isMobileOpen ? 'hidden' : '';
    }
  }, [isMobileOpen]);

  const handleNewChat = (toolId = null) => {
    const newChat = createNewThread(toolId);
    console.log('[Sidebar] Created new chat object:', JSON.stringify(newChat));
    console.log(`[Sidebar] Attempting to set current chat. Tool ID passed: ${toolId}, New chat tool_id: ${newChat.tool_id}`);
    setChats(prevChats => [newChat, ...prevChats]);
    setCurrentChat(newChat);
    setSelectedTool(toolId);
    setIsMobileOpen(false);
  };

  const handleToolClick = (toolId) => {
    console.log('[Sidebar] Tool clicked:', toolId);
    const existingChat = chats.find(chat => chat.tool_id === toolId && chat.messages.length === 0);
    if (existingChat) {
      console.log('[Sidebar] Using existing chat:', existingChat.id);
      setCurrentChat(existingChat);
      setSelectedTool(toolId);
    } else {
      console.log('[Sidebar] Creating new chat for tool:', toolId);
      handleNewChat(toolId);
    }
    // Close mobile sidebar after tool selection
    setIsMobileOpen(false);
  };

  // Show all non-temporary chats regardless of the selected tool
  // Apply search query to chat titles
  const filteredChats = chats
    .filter(chat => !chat.isTemporary)
    .filter(chat => chat.title.toLowerCase().includes(searchQuery.toLowerCase()));
  
  // Only show a limited number of chats unless expanded
  const visibleChats = expandedChats ? filteredChats : filteredChats.slice(0, INITIAL_CHAT_COUNT);
  const hasMoreChats = filteredChats.length > INITIAL_CHAT_COUNT;

  // Get chat tool icon based on tool_id
  const getChatIcon = (chat) => {
    if (!chat.tool_id) {
      return <MessagesSquare className="h-4 w-4 mr-2 text-muted-foreground" />;
    }
    
    const IconComponent = toolIcons[chat.tool_id] || MessageSquare;
    return <IconComponent className="h-4 w-4 mr-2 text-muted-foreground" />;
  };

  // Delete chat handler
  const handleDeleteChat = async (chatId) => {
    try {
      console.log('[Sidebar] Attempting to delete chat:', chatId);
      await deleteThread(chatId);
      console.log('[Sidebar] Chat deleted successfully:', chatId);
      
      // Remove from UI state
      if (currentChat?.id === chatId) {
        const remainingChats = chats.filter(chat => chat.id !== chatId);
        if (remainingChats.length > 0) {
          setCurrentChat(remainingChats[0]);
          setSelectedTool(remainingChats[0].tool_id || null);
        } else {
          setCurrentChat(null);
          setSelectedTool(null);
        }
      }
      
      // Remove from chats list
      setChats(prev => prev.filter(chat => chat.id !== chatId));
    } catch (err) {
      console.error('[Sidebar] Delete chat error:', err);
      alert('Failed to delete chat. Please try again.');
    }
  };

  // Mobile menu toggle button - fixed to top left
  const MobileMenuButton = () => (
    <div className="fixed top-4 left-4 z-50 md:hidden">
      <Button 
        variant="outline" 
        size="icon" 
        className="h-12 w-12 rounded-full bg-background shadow-lg border touch-target"
        onClick={() => {
          console.log('[Sidebar] Mobile menu button clicked, current state:', isMobileOpen);
          setIsMobileOpen(!isMobileOpen);
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          console.log('[Sidebar] Mobile menu button touched');
          setIsMobileOpen(!isMobileOpen);
        }}
      >
        {isMobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>
    </div>
  );

  // Handle swipe gestures for closing sidebar
  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    
    // Close sidebar on left swipe (swipe to the left)
    if (isLeftSwipe && isMobileOpen) {
      setIsMobileOpen(false);
    }
    
    // Reset touch states
    setTouchStart(0);
    setTouchEnd(0);
  };

  return (
    <>
      <MobileMenuButton />
      
      <div className={`
        w-[280px] h-screen border-r flex flex-col bg-background fixed left-0 top-0 z-50
        transition-transform duration-300 ease-in-out
        md:translate-x-0 md:shadow-none
        ${isMobileOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'}
      `}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      >
        {/* Header with logo */}
        <div className="p-3 flex items-center justify-between border-b">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="font-semibold text-sm">SovereignAI</span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell 
              chats={chats}
              setCurrentChat={setCurrentChat}
              currentChat={currentChat}
            />
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-10 w-10 md:hidden touch-target"
              onClick={() => setIsMobileOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search chats..."
              className="pl-7 pr-3 py-1.5 w-full rounded-md border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent h-7"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-grow flex flex-col overflow-hidden">
          {/* Specialized Tools Section */}
          <div className="p-3 border-b">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <Wrench className="h-4 w-4 mr-1.5 text-muted-foreground" />
                <h4 className="font-medium text-sm">Specialized Tools</h4>
              </div>
            </div>
            <div className="space-y-0.5 ml-5">
              <div className="flex items-center justify-between mb-0.5">
                <Button
                  variant={!selectedTool ? "secondary" : "ghost"}
                  className="w-full justify-start min-h-[44px] text-sm touch-target"
                  onClick={() => handleNewChat(null)}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    handleNewChat(null);
                  }}
                >
                  <MessagesSquare className="h-3.5 w-3.5 mr-1.5" />
                  <span className="text-sm">JamesBot</span>
                  <Plus className="h-3.5 w-3.5 ml-auto" />
                </Button>
              </div>
              {tools.map((tool) => {
                const IconComponent = toolIcons[tool.id] || MessageSquare;
                return (
                  <div key={tool.id} className="flex items-center justify-between mb-0.5">
                    <Button
                      variant={selectedTool === tool.id ? "secondary" : "ghost"}
                      className="w-full justify-start min-h-[44px] text-sm touch-target"
                      onClick={() => handleToolClick(tool.id)}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        handleToolClick(tool.id);
                      }}
                    >
                      <IconComponent className="h-3.5 w-3.5 mr-1.5" />
                      <span className="truncate text-sm">{tool.name}</span>
                      <Plus className="h-3.5 w-3.5 ml-auto" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chats/Past Conversations Section */}
          <div className="p-3 flex flex-col overflow-hidden flex-1">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <MessagesSquare className="h-4 w-4 mr-1.5 text-muted-foreground" />
                <h4 className="font-medium text-sm">Chat History</h4>
              </div>
            </div>
            
            <ScrollArea className="flex-1 h-full pr-3 overflow-visible hover:overflow-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-3 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  <span className="text-xs">Loading...</span>
                </div>
              ) : visibleChats.length > 0 ? (
                <div className="space-y-0.5 ml-5">
                  {visibleChats.map((chat) => (
                    <div key={chat.id} className="flex items-center mb-0.5">
                      <button 
                        className="mr-1 p-1.5 rounded hover:bg-red-100 text-red-600 min-h-[36px] min-w-[36px] flex items-center justify-center touch-target" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteChat(chat.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <Button
                        variant={currentChat?.id === chat.id ? "secondary" : "ghost"}
                        className="w-full justify-start px-2 h-9 text-sm hover:bg-muted touch-target"
                        onClick={() => {
                          setCurrentChat(chat);
                          setSelectedTool(chat.tool_id || null);
                        }}
                      >
                        {getChatIcon(chat)}
                        <span className="truncate text-sm">{chat.title || "New Chat"}</span>
                      </Button>
                    </div>
                  ))}
                  
                  {hasMoreChats && (
                    <Button 
                      variant="ghost" 
                      className="w-full text-xs text-muted-foreground flex items-center justify-center mt-1"
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
                <div className="text-center p-3 text-muted-foreground ml-5">
                  <p className="text-xs">No conversations yet</p>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* User Profile - Styled like the image */}
        <div className="p-3 border-t mt-auto">
          {user ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                  <Avatar className="h-7 w-7 border">
                    <AvatarImage src={user.user_metadata?.avatar_url} alt={user.email} />
                    <AvatarFallback>{user.email?.[0].toUpperCase() || "U"}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium truncate" title={user.email}>
                      {user.email?.split('@')[0].split('.')[0][0].toUpperCase() + user.email?.split('@')[0].split('.')[0].slice(1) || "User"}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {user.email || "example@example.com"}
                    </span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={signOut} title="Log Out">
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex flex-col gap-0.5 mt-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start h-10 text-xs mb-0.5 touch-target"
                  onClick={() => {
                    setIsSnippetsModalOpen(true);
                    setIsMobileOpen(false);
                  }}
                >
                  <Bookmark className="h-3.5 w-3.5 mr-1.5" />
                  My Snippets
                </Button>

                <Button
                  variant="ghost"
                  className="w-full justify-start h-10 text-xs mb-0.5 touch-target"
                  onClick={() => {
                    router.push('/profile');
                    setIsMobileOpen(false);
                  }}
                >
                  <Settings className="h-3.5 w-3.5 mr-1.5" />
                  Profile Settings
                </Button>
                
                {!profileComplete && (
                  <div className="px-2">
                    <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 px-2 py-1 rounded-md flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Complete your profile for better personalization
                    </div>
                  </div>
                )}
              </div>
            </>
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

      {/* Snippets Modal */}
      <SnippetsModal 
        isOpen={isSnippetsModalOpen} 
        onClose={() => setIsSnippetsModalOpen(false)} 
      />
    </>
  );
} 