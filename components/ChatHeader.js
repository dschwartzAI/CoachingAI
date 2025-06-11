import { useState } from 'react';
import { useChatStore } from '@/lib/stores/chat-store';

const ChatHeader = ({ chat }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(chat?.title || '');
  const updateChatTitle = useChatStore(state => state.updateChatTitle);

  const handleSaveTitle = async () => {
    if (editedTitle.trim() && editedTitle !== chat.title) {
      await updateChatTitle(chat.id, editedTitle.trim(), true);
    }
    setIsEditing(false);
  };

  return (
    <div className="border-b p-4 flex items-center justify-between">
      {isEditing ? (
        <input
          type="text"
          value={editedTitle}
          onChange={(e) => setEditedTitle(e.target.value)}
          onBlur={handleSaveTitle}
          onKeyPress={(e) => e.key === 'Enter' && handleSaveTitle()}
          className="text-lg font-semibold bg-transparent border-b border-gray-300 focus:outline-none focus:border-blue-500"
          autoFocus
        />
      ) : (
        <h2
          className="text-lg font-semibold cursor-pointer hover:text-gray-700"
          onClick={() => setIsEditing(true)}
          title="Click to edit title"
        >
          {chat?.title || 'New conversation'}
        </h2>
      )}
    </div>
  );
};

export default ChatHeader; 