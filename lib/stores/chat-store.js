"use client";

import { create } from 'zustand';
import { getThreads, getUserProfile, isProfileComplete } from '@/lib/utils/supabase';
import { createNewThread } from '@/lib/utils/thread';

// Helper function to check if an ID is a valid UUID
const isValidUUID = (id) => {
  if (!id) return false;
  const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidV4Pattern.test(id);
};

export const useChatStore = create((set, get) => ({
  chats: [],
  currentChat: null,
  currentChatId: null,
  messages: [],
  // Add any other state as needed

  // Loading states
  isLoadingChat: false,
  isSidebarLoading: false,
  isInitialLoad: true,
  
  // Selected tool
  selectedTool: null,
  
  // Profile state
  profileComplete: false,
  profileChecked: false,
  
  // Sidebar state
  isSidebarCollapsed: false,
  
  // ID mappings for temporary to permanent IDs
  idMappings: {},
  
  // Actions
  setCurrentChat: async (chatId) => {
    const state = get();
    
    // If same chat, do nothing
    if (state.currentChatId === chatId) return;
    
    // Find chat in existing chats
    const chat = state.chats.find(c => c.id === chatId);
    
    if (chat) {
      set({ 
        currentChatId: chatId,
        currentChat: chat,
        selectedTool: chat.tool_id || null
      });
      
      // Update URL without page reload
      if (typeof window !== 'undefined' && isValidUUID(chatId)) {
        window.history.pushState({}, '', `/chat/${chatId}`);
      }
    }
  },
  
  setCurrentChatDirectly: (chat) => {
    set({ 
      currentChatId: chat?.id || null,
      currentChat: chat,
      selectedTool: chat?.tool_id || null
    });
    
    // Update URL without page reload
    if (typeof window !== 'undefined' && chat?.id && isValidUUID(chat.id)) {
      window.history.pushState({}, '', `/chat/${chat.id}`);
    }
  },
  
  loadChats: async (userId) => {
    if (!userId) return;
    
    set({ isSidebarLoading: true });
    
    try {
      const threads = await getThreads(userId);
      
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
      
      set({ 
        chats: formattedThreads,
        isSidebarLoading: false,
        isInitialLoad: false
      });
      
      return formattedThreads;
    } catch (error) {
      console.error('[ChatStore] Error loading threads:', error);
      set({ 
        isSidebarLoading: false,
        isInitialLoad: false
      });
      throw error;
    }
  },
  
  // For optimistic updates when creating new chat
  addOptimisticChat: (tempChat) => {
    set(state => ({
      chats: [tempChat, ...state.chats],
      currentChatId: tempChat.id,
      currentChat: tempChat,
      selectedTool: tempChat.tool_id || null
    }));
    
    // Update URL without page reload
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', `/chat/${tempChat.id}`);
    }
  },
  
  // Replace optimistic chat with real one
  replaceOptimisticChat: (tempId, realChat) => {
    set(state => ({
      chats: state.chats.map(c => c.id === tempId ? realChat : c),
      currentChatId: realChat.id,
      currentChat: realChat,
      idMappings: { ...state.idMappings, [tempId]: realChat.id }
    }));
    
    // Update URL with real ID
    if (typeof window !== 'undefined' && isValidUUID(realChat.id)) {
      window.history.replaceState({}, '', `/chat/${realChat.id}`);
    }
  },
  
  // Update existing chat
  updateChat: (chatId, updates) => {
    set(state => {
      const updatedChats = state.chats.map(chat => 
        chat.id === chatId ? { ...chat, ...updates } : chat
      );
      
      const updatedCurrentChat = state.currentChatId === chatId 
        ? { ...state.currentChat, ...updates }
        : state.currentChat;
      
      return {
        chats: updatedChats,
        currentChat: updatedCurrentChat
      };
    });
  },
  
  // Update chat messages
  updateChatMessages: (chatId, messages) => {
    set(state => {
      const updatedChats = state.chats.map(chat => 
        chat.id === chatId ? { ...chat, messages } : chat
      );
      
      const updatedCurrentChat = state.currentChatId === chatId 
        ? { ...state.currentChat, messages }
        : state.currentChat;
      
      return {
        chats: updatedChats,
        currentChat: updatedCurrentChat
      };
    });
  },
  
  // Delete chat
  deleteChat: (chatId) => {
    set(state => {
      const remainingChats = state.chats.filter(chat => chat.id !== chatId);
      
      // If deleting current chat, switch to another
      let newCurrentChat = state.currentChat;
      let newCurrentChatId = state.currentChatId;
      let newSelectedTool = state.selectedTool;
      
      if (state.currentChatId === chatId) {
        if (remainingChats.length > 0) {
          newCurrentChat = remainingChats[0];
          newCurrentChatId = remainingChats[0].id;
          newSelectedTool = remainingChats[0].tool_id || null;
        } else {
          newCurrentChat = null;
          newCurrentChatId = null;
          newSelectedTool = null;
        }
      }
      
      return {
        chats: remainingChats,
        currentChat: newCurrentChat,
        currentChatId: newCurrentChatId,
        selectedTool: newSelectedTool
      };
    });
  },
  
  // Create new chat
  createNewChat: (toolId = null) => {
    const newChat = createNewThread(toolId);
    newChat.isNewChat = true;
    if (toolId) {
      newChat.isCurrentChatToolInit = true;
    }
    
    get().addOptimisticChat(newChat);
    return newChat;
  },
  
  // Set selected tool
  setSelectedTool: (toolId) => {
    set({ selectedTool: toolId });
  },
  
  // Profile methods
  checkProfileCompletion: async (userId) => {
    try {
      const profile = await getUserProfile(userId);
      const isComplete = isProfileComplete(profile);
      
      set({ 
        profileComplete: isComplete,
        profileChecked: true
      });
      
      return { profile, isComplete };
    } catch (error) {
      console.error('[ChatStore] Error checking profile:', error);
      set({ profileChecked: true });
      throw error;
    }
  },
  
  setProfileComplete: (isComplete) => {
    set({ profileComplete: isComplete });
  },
  
  // Sidebar actions
  toggleSidebar: () => {
    set(state => ({ isSidebarCollapsed: !state.isSidebarCollapsed }));
  },
  
  setSidebarCollapsed: (collapsed) => {
    set({ isSidebarCollapsed: collapsed });
  },
  
  // Reset store
  reset: () => {
    set({
      currentChatId: null,
      currentChat: null,
      chats: [],
      isLoadingChat: false,
      isSidebarLoading: false,
      isInitialLoad: true,
      selectedTool: null,
      profileComplete: false,
      profileChecked: false,
      isSidebarCollapsed: false,
      idMappings: {}
    });
  },

  // Update chat title and hasCustomTitle
  updateChatTitle: async (chatId, title, isCustom = true) => {
    // Optimistically update the UI
    set(state => ({
      chats: state.chats.map(chat =>
        chat.id === chatId
          ? { ...chat, title: title.trim(), has_custom_title: isCustom }
          : chat
      ),
      currentChat: state.currentChat?.id === chatId
        ? { ...state.currentChat, title: title.trim(), has_custom_title: isCustom }
        : state.currentChat
    }));
    
    try {
      const response = await fetch(`/api/chats/${chatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), hasCustomTitle: isCustom })
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to update chat title:', error);
        // Revert the optimistic update on error
        await get().loadChats(get().currentChat?.user_id);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error updating chat title:', error);
      // Revert the optimistic update on error
      await get().loadChats(get().currentChat?.user_id);
      return false;
    }
  },

  shouldGenerateTitle: (chatId) => {
    const chat = get().chats.find(c => c.id === chatId);
    return chat && !chat.hasCustomTitle && chat.title && chat.title.startsWith('New ');
  }
})); 