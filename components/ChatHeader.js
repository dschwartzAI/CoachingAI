import { useState, useEffect } from 'react';
import { useChatStore } from '@/lib/stores/chat-store';
import { Edit3 } from 'lucide-react';

const ChatHeader = ({ chat }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const updateChatTitle = useChatStore(state => state.updateChatTitle);

  // Update editedTitle when chat changes
  useEffect(() => {
    setEditedTitle(chat?.title || '');
  }, [chat?.title]);

  const handleSaveTitle = async () => {
    if (editedTitle.trim() && editedTitle !== chat?.title && chat?.id) {
      await updateChatTitle(chat.id, editedTitle.trim(), true);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      setEditedTitle(chat?.title || '');
      setIsEditing(false);
    }
  };

  const handleStartEdit = () => {
    if (chat?.id) {
      setIsEditing(true);
    }
  };

  return (
    <div className="border-b p-3 sm:p-4 flex items-center">
      <div className="flex items-center space-x-2 pl-6">
        {isEditing ? (
          <input
            type="text"
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={handleKeyDown}
            className="text-base sm:text-lg font-semibold bg-transparent border-b-2 border-primary/50 focus:outline-none focus:border-primary w-full max-w-md"
            autoFocus
            placeholder="Enter chat title..."
          />
        ) : (
          <div
            className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded-md px-2 py-1 -mx-2 transition-colors group"
            onClick={handleStartEdit}
            title="Click to edit title"
          >
            <h2 className="text-base sm:text-lg font-semibold text-foreground">
              {chat?.title || 'New Conversation'}
            </h2>
            <Edit3 className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatHeader; 