"use client";

import { useState, useRef, useEffect } from 'react';
import { Check, X, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useChatStore } from '@/lib/stores/chat-store';
import { useToast } from '@/hooks/use-toast';

export default function EditableChatTitle({ chat, isActive }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(chat.title);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);
  const { updateChatTitle } = useChatStore();
  const { toast } = useToast();

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditedTitle(chat.title);
  }, [chat.title]);

  const handleSave = async () => {
    const trimmedTitle = editedTitle.trim();
    
    if (!trimmedTitle) {
      toast({
        title: "Error",
        description: "Chat title cannot be empty",
        variant: "destructive",
      });
      setEditedTitle(chat.title);
      setIsEditing(false);
      return;
    }

    if (trimmedTitle === chat.title) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    const success = await updateChatTitle(chat.id, trimmedTitle, true);
    
    if (success) {
      toast({
        title: "Success",
        description: "Chat title updated",
      });
    } else {
      toast({
        title: "Error", 
        description: "Failed to update chat title",
        variant: "destructive",
      });
      setEditedTitle(chat.title);
    }
    
    setIsLoading(false);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedTitle(chat.title);
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1 flex-1">
        <Input
          ref={inputRef}
          value={editedTitle}
          onChange={(e) => setEditedTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-7 text-sm px-2"
          disabled={isLoading}
          onClick={(e) => e.stopPropagation()}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={(e) => {
            e.stopPropagation();
            handleSave();
          }}
          disabled={isLoading}
        >
          <Check className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={(e) => {
            e.stopPropagation();
            handleCancel();
          }}
          disabled={isLoading}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 flex-1 group">
      <span className="truncate flex-1">{chat.title}</span>
      {isActive && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
        >
          <Edit2 className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
} 