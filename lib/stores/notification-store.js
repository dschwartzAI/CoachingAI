import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useNotificationStore = create(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,
      
      // Only add notifications for specific user actions
      addNotification: (notification) => {
        // Validate that this is a legitimate notification trigger
        const validTriggers = [
          'hybrid_offer_created',
          'workshop_generated',
          'chat_exported',
          'snippet_saved',
          'document_ready'
        ];
        
        if (!validTriggers.includes(notification.type)) {
          console.warn(`Invalid notification type: ${notification.type}`);
          return;
        }
        
        const newNotification = {
          id: `${notification.type}-${Date.now()}`,
          timestamp: new Date(),
          read: false,
          ...notification
        };
        
        set(state => ({
          notifications: [newNotification, ...state.notifications].slice(0, 50), // Keep max 50 notifications
          unreadCount: state.unreadCount + 1
        }));
      },
      
      // Clear all notifications
      clearAll: () => {
        set({ notifications: [], unreadCount: 0 });
      },
      
      // Mark as read
      markAsRead: (notificationId) => {
        set(state => {
          const notification = state.notifications.find(n => n.id === notificationId);
          if (!notification || notification.read) return state;
          
          return {
            notifications: state.notifications.map(n => 
              n.id === notificationId ? { ...n, read: true } : n
            ),
            unreadCount: Math.max(0, state.unreadCount - 1)
          };
        });
      },
      
      // Remove a specific notification
      removeNotification: (notificationId) => {
        set(state => {
          const notification = state.notifications.find(n => n.id === notificationId);
          if (!notification) return state;
          
          return {
            notifications: state.notifications.filter(n => n.id !== notificationId),
            unreadCount: notification.read ? state.unreadCount : Math.max(0, state.unreadCount - 1)
          };
        });
      },
      
      // Initialize from storage without duplicating
      initializeNotifications: () => {
        const stored = get().notifications;
        // Remove any duplicates based on unique criteria
        const unique = stored.filter((notification, index, self) =>
          index === self.findIndex(n => 
            n.type === notification.type && 
            n.timestamp === notification.timestamp &&
            n.message === notification.message
          )
        );
        
        if (unique.length !== stored.length) {
          const unreadCount = unique.filter(n => !n.read).length;
          set({ 
            notifications: unique,
            unreadCount
          });
        }
      }
    }),
    {
      name: 'notification-storage',
      // Don't persist test/demo notifications
      partialize: (state) => ({
        notifications: state.notifications.filter(n => 
          !n.isDemo && !n.isTest
        ).slice(0, 50), // Only persist last 50 notifications
        unreadCount: state.unreadCount
      })
    }
  )
);

export default useNotificationStore; 