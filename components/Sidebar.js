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
  Bookmark,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { TOOLS } from '@/lib/config/tools';
import { deleteThread } from '@/lib/utils/supabase';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { usePostHog } from '@/hooks/use-posthog';
import SnippetModal from './SnippetModal';
import useChatStore from '@/lib/stores/chat-store';

// Tool icons mapping
const toolIcons = {
  'hybrid-offer': FileText,
  'workshop-generator': Monitor
};

export default function Sidebar({ onShowProfile }) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { track } = usePostHog();
  const [expandedChats, setExpandedChats] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showSnippets, setShowSnippets] = useState(false);
  const INITIAL_CHAT_COUNT = 6;
  
  // Get state and actions from global store
  const {
    chats,
    currentChat,
    selectedTool,
    profileComplete,
    isLoading,
    isSidebarCollapsed,
    setCurrentChat,
    setSelectedTool,
    createNewChat,
    deleteChat: deleteChatFromStore,
    updateChat,
    toggleSidebar
  } = useChatStore();

  const tools = Object.entries(TOOLS).map(([id, tool]) => ({
    id,
    ...tool
  }));

  // Close sidebar on mobile when navigating
  useEffect(() => {
    // Only close on mobile (when screen width is less than md breakpoint)
    if (window.innerWidth < 768) {
      setIsMobileOpen(false);
    }
  }, [currentChat]);

  const handleNewChat = (toolId = null) => {
    const newChat = createNewChat(toolId);
    track('chat_created', { chatId: newChat.id, toolId });
    
    // Only close sidebar on mobile
    if (window.innerWidth < 768) {
      setIsMobileOpen(false);
    }
  };

  const handleToolClick = (toolId) => {
    const existingChat = chats.find(chat => chat.tool_id === toolId && chat.messages.length === 0);
    if (existingChat) {
      setCurrentChat(existingChat.id);
    } else {
      handleNewChat(toolId);
    }
  };

  const handleChatClick = (chat) => {
    console.log('[Sidebar] Chat clicked:', { chatId: chat.id, title: chat.title });
    setCurrentChat(chat.id);
    
    // Only close sidebar on mobile
    if (window.innerWidth < 768) {
      setIsMobileOpen(false);
    }
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
    
    const IconComponent = toolIcons[chat.tool_id] || MessageSquare;
    return <IconComponent className="h-4 w-4 mr-2 text-muted-foreground" />;
  };

  // Delete chat handler
  const handleDeleteChat = async (chatId) => {
    try {
      console.log('[Sidebar] Attempting to delete chat:', chatId);
      await deleteThread(chatId);
      console.log('[Sidebar] Chat deleted successfully:', chatId);
      
      // Remove from store
      deleteChatFromStore(chatId);
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
        ${isSidebarCollapsed ? 'w-[60px]' : 'w-[300px]'} h-screen border-r flex flex-col bg-background fixed left-0 top-0 z-40
        transition-all duration-300 ease-in-out overflow-hidden
        md:translate-x-0 md:shadow-none
        ${isMobileOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Header with logo */}
        <div className="p-4 flex items-center justify-between border-b">
          {!isSidebarCollapsed ? (
            <div className="flex items-center justify-between w-full opacity-100 transition-all duration-300 ease-in-out">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                <span className="font-semibold">Sovereign AI</span>
              </div>
              <div className="flex items-center gap-2">
                <NotificationBell />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="hidden md:flex"
                  onClick={toggleSidebar}
                  title="Close sidebar"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
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
          ) : (
            <div className="flex items-center justify-center w-full opacity-100 transition-all duration-300 ease-in-out">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={toggleSidebar}
                title="Open sidebar"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        
        {!isSidebarCollapsed ? (
          <div className="flex-grow flex flex-col overflow-hidden opacity-100 transition-all duration-300 ease-in-out">
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
                    className="w-full justify-start h-8 text-sm"
                    onClick={() => handleNewChat(null)}
                  >
                    <MessagesSquare className="h-4 w-4 mr-2" />
                    JamesBot
                    <Plus className="h-4 w-4 ml-auto" />
                  </Button>
                </div>
                {tools.map((tool) => {
                  const IconComponent = toolIcons[tool.id] || MessageSquare;
                  return (
                    <div key={tool.id} className="flex items-center justify-between mb-1">
                      <Button
                        variant={selectedTool === tool.id ? "secondary" : "ghost"}
                        className="w-full justify-start h-8 text-sm"
                        onClick={() => handleToolClick(tool.id)}
                      >
                        <IconComponent className="h-4 w-4 mr-2" />
                        {tool.name}
                        <Plus className="h-4 w-4 ml-auto" />
                      </Button>
                    </div>
                  );
                })}
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
                      <div key={chat.id} className="flex items-center mb-1 relative">
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
                          className={`w-full justify-start px-2 h-8 text-sm hover:bg-muted relative ${
                            currentChat?.id === chat.id ? 'bg-secondary font-medium border-l-2 border-primary' : ''
                          }`}
                          onClick={() => handleChatClick(chat)}
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
        ) : (
          <div className="flex-grow flex flex-col items-center py-4 gap-2 opacity-100 transition-all duration-300 ease-in-out">
            {/* Collapsed state - Quick action buttons */}
            <Button
              variant={!selectedTool ? "secondary" : "ghost"}
              size="icon"
              onClick={() => handleNewChat(null)}
              title="New JamesBot Chat"
              className="h-10 w-10"
            >
              <MessagesSquare className="h-5 w-5" />
            </Button>
            
            {tools.map((tool) => {
              const IconComponent = toolIcons[tool.id] || MessageSquare;
              return (
                <Button
                  key={tool.id}
                  variant={selectedTool === tool.id ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => handleToolClick(tool.id)}
                  title={`New ${tool.name}`}
                  className="h-10 w-10"
                >
                  <IconComponent className="h-5 w-5" />
                </Button>
              );
            })}
            
            <div className="flex-1" />
            
            {/* Recent chats - show first 3 */}
            {visibleChats.slice(0, 3).map((chat) => (
              <Button
                key={chat.id}
                variant={currentChat?.id === chat.id ? "secondary" : "ghost"}
                size="icon"
                onClick={() => handleChatClick(chat)}
                title={chat.title}
                className="h-10 w-10"
              >
                {getChatIcon(chat).props.children}
              </Button>
            ))}
          </div>
        )}

        {/* User Profile - Styled like the image */}
        <div className="p-4 border-t mt-auto">
          {user ? (
            <>
              {!isSidebarCollapsed ? (
                <div className="opacity-100 transition-all duration-300 ease-in-out">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <Avatar className="h-8 w-8 border">
                        <AvatarImage src={user.user_metadata?.avatar_url} alt={user.email} />
                        <AvatarFallback>{user.email?.[0].toUpperCase() || "U"}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium truncate" title={user.email}>
                          {user.email?.split('@')[0].split('.')[0][0].toUpperCase() + user.email?.split('@')[0].split('.')[0].slice(1) || "User"}
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
                  <div className="flex flex-col gap-1 mt-2">
                    <Button
                      variant="ghost"
                      className="w-full justify-start px-2 h-8 text-sm hover:bg-muted"
                      onClick={() => {
                        onShowProfile();
                        // Only close sidebar on mobile
                        if (window.innerWidth < 768) {
                          setIsMobileOpen(false);
                        }
                      }}
                    >
                      <User className="h-4 w-4 mr-2" />
                      Profile Settings
                      {profileComplete ? (
                        <CheckCircle2 className="h-3 w-3 ml-auto text-green-500" />
                      ) : (
                        <AlertCircle className="h-3 w-3 ml-auto text-amber-500" />
                      )}
                    </Button>
                    
                    <Button
                      variant="ghost"
                      className="w-full justify-start px-2 h-8 text-sm hover:bg-muted"
                      onClick={() => {
                        setShowSnippets(true);
                        // Only close sidebar on mobile
                        if (window.innerWidth < 768) {
                          setIsMobileOpen(false);
                        }
                      }}
                    >
                      <Bookmark className="h-4 w-4 mr-2" />
                      Snippets
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
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 opacity-100 transition-all duration-300 ease-in-out">
                  <Avatar className="h-8 w-8 border">
                    <AvatarImage src={user.user_metadata?.avatar_url} alt={user.email} />
                    <AvatarFallback>{user.email?.[0].toUpperCase() || "U"}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        onShowProfile();
                      }}
                      title="Profile Settings"
                      className="h-8 w-8"
                    >
                      <User className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setShowSnippets(true);
                      }}
                      title="Snippets"
                      className="h-8 w-8"
                    >
                      <Bookmark className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={signOut}
                      title="Log Out"
                      className="h-8 w-8"
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="w-full flex justify-center">
              <Button className="w-full" onClick={() => router.push('/login')}>
                <LogIn className="mr-2 h-4 w-4" /> Login / Sign Up
              </Button>
            </div>
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
      <SnippetModal 
        open={showSnippets} 
        onOpenChange={setShowSnippets}
      />
    </>
  );
} 