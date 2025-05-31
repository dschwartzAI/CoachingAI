"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "./AuthProvider";

export default function NotificationBell({ chats, setCurrentChat, currentChat }) {
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [processedChats, setProcessedChats] = useState(new Set());
  const [isInitialized, setIsInitialized] = useState(false);
  const { user } = useAuth();

  // Load notifications and processed chats from localStorage on mount
  useEffect(() => {
    if (user?.id && !isInitialized) {
      const savedNotifications = localStorage.getItem(`notifications_${user.id}`);
      if (savedNotifications) {
        try {
          const parsed = JSON.parse(savedNotifications);
          // Convert timestamp strings back to Date objects and clean up old format
          const notificationsWithDates = parsed.map(n => ({
            id: n.id,
            chatId: n.chatId,
            chatTitle: n.chatTitle,
            message: n.message,
            timestamp: new Date(n.timestamp),
            type: n.type
            // Note: removed 'read' property as we no longer track read status
          }));
          setNotifications(notificationsWithDates);
        } catch (error) {
          console.error('Error parsing saved notifications:', error);
        }
      }

      // Load processed chats tracking
      const savedProcessedChats = localStorage.getItem(`processedChats_${user.id}`);
      if (savedProcessedChats) {
        try {
          const parsed = JSON.parse(savedProcessedChats);
          setProcessedChats(new Set(parsed));
        } catch (error) {
          console.error('Error parsing saved processed chats:', error);
        }
      }
      
      setIsInitialized(true);
    }
  }, [user?.id, isInitialized]);

  // Save notifications to localStorage whenever they change
  useEffect(() => {
    if (user?.id && isInitialized) {
      if (notifications.length > 0) {
        localStorage.setItem(`notifications_${user.id}`, JSON.stringify(notifications));
      } else {
        // Remove the localStorage entry if no notifications remain
        localStorage.removeItem(`notifications_${user.id}`);
      }
    }
  }, [notifications, user?.id, isInitialized]);

  // Save processed chats to localStorage whenever they change
  useEffect(() => {
    if (user?.id && processedChats.size > 0 && isInitialized) {
      localStorage.setItem(`processedChats_${user.id}`, JSON.stringify([...processedChats]));
    }
  }, [processedChats, user?.id, isInitialized]);

  // Memoized function to check for document completion
  const hasDocumentCompletion = useCallback((chat) => {
    const hasDocumentMessage = chat.messages?.some(message => 
      message.role === 'assistant' && 
      (message.content?.includes('Document generated successfully') ||
       message.content?.includes('✅ Document generated successfully!')) &&
      (message.metadata?.documentLinks?.googleDocLink || 
       message.content?.includes('https://docs.google.com/document/'))
    );
    
    // Also check thread metadata for document completion
    const hasDocumentInMetadata = chat.metadata?.documentGenerated && 
                                 chat.metadata?.documentLinks?.googleDocLink;
    
    return hasDocumentMessage || hasDocumentInMetadata;
  }, []);

  // Check for new document completions - only run when chats change and we're initialized
  useEffect(() => {
    if (!chats || !user || !isInitialized) return;

    const newNotifications = [];
    const chatsToProcess = new Set();
    
    chats.forEach(chat => {
      // Skip if we've already processed this chat for notifications
      if (processedChats.has(chat.id)) return;

      // Check if this chat has a completed document
      if (hasDocumentCompletion(chat)) {
        // Mark this chat as needing processing
        chatsToProcess.add(chat.id);
        
        // Create notification
        newNotifications.push({
          id: `doc-ready-${chat.id}-${Date.now()}`,
          chatId: chat.id,
          chatTitle: chat.title || 'Hybrid Offer',
          message: 'Your document is ready!',
          timestamp: new Date(),
          type: 'document_ready'
        });
      }
    });

    // Only update state if we have new notifications
    if (newNotifications.length > 0) {
      console.log(`[NotificationBell] Adding ${newNotifications.length} new notifications`);
      setNotifications(prev => [...newNotifications, ...prev]);
      
      // Update processed chats with new ones
      setProcessedChats(prev => {
        const updated = new Set(prev);
        chatsToProcess.forEach(chatId => updated.add(chatId));
        return updated;
      });
    }
  }, [chats, user, isInitialized, hasDocumentCompletion]); // Removed processedChats from dependencies

  const removeNotification = (notificationId) => {
    console.log(`[NotificationBell] Removing notification: ${notificationId}`);
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const handleNotificationClick = (notification) => {
    // Find the chat and switch to it
    const targetChat = chats.find(c => c.id === notification.chatId);
    if (targetChat) {
      setCurrentChat(targetChat);
      // Remove the notification instead of just marking as read
      removeNotification(notification.id);
      setShowNotifications(false);
    }
  };

  const clearAllNotifications = () => {
    console.log('[NotificationBell] Clearing all notifications');
    setNotifications([]);
    setShowNotifications(false);
    if (user?.id) {
      localStorage.removeItem(`notifications_${user.id}`);
    }
    // Note: We don't clear processedChats here - this prevents notifications from reappearing
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setShowNotifications(!showNotifications)}
      >
        <Bell className="h-5 w-5" />
        {notifications.length > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
          >
            {notifications.length}
          </Badge>
        )}
      </Button>

      {showNotifications && (
        <Card className="absolute top-full left-full ml-2 mt-2 w-80 max-w-[calc(100vw-2rem)] z-50 shadow-lg border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Notifications</h3>
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllNotifications}
                  className="text-xs h-6 px-2"
                >
                  Clear all
                </Button>
              )}
            </div>
            
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No notifications
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="p-3 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                          <p className="text-sm font-medium truncate">
                            Document Ready
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Your {notification.chatTitle} document is ready to view
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {notification.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeNotification(notification.id);
                        }}
                        className="h-6 w-6 p-0 flex-shrink-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
} 