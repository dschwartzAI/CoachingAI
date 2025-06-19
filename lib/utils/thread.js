import { TOOLS } from '@/lib/config/tools';

export function createNewThread(toolId = null) {
  if (toolId) {
    // For tool-based chats, create with tool name
    const tool = TOOLS[toolId];
    return {
      id: Date.now().toString(), // Temporary ID until saved to database
      title: tool.name,
      tool_id: toolId,
      messages: [],
      isTemporary: false // This thread should be saved immediately
    };
  } else {
    // For regular chats, create a temporary thread
    return {
      id: Date.now().toString(),
      title: "New conversation",
      tool_id: null,
      messages: [],
      isTemporary: true // This thread shouldn't be saved until first message
    };
  }
}

export function generateThreadTitle(firstMessage) {
  if (!firstMessage) {
    if (process.env.NODE_ENV !== "production") console.warn('[Thread] No first message provided for title generation');
    return "New conversation";
  }
  
  // Handle both string and message object formats
  let messageContent;
  if (typeof firstMessage === 'string') {
    messageContent = firstMessage;
  } else if (firstMessage && typeof firstMessage === 'object' && firstMessage.content) {
    messageContent = firstMessage.content;
  } else {
    if (process.env.NODE_ENV !== "production") console.warn('[Thread] Invalid first message for title generation:', firstMessage);
    return "New conversation";
  }
  
  // Truncate and clean the message content to create a title
  const maxLength = 30;
  let title = messageContent.trim();
  
  // Remove any newlines or extra whitespace
  title = title.replace(/\s+/g, ' ');
  
  if (title.length > maxLength) {
    // Cut at the last complete word within maxLength
    title = title.substr(0, maxLength).split(' ').slice(0, -1).join(' ') + '...';
  }
  
  if (process.env.NODE_ENV !== "production") console.log('[Thread] Generated title:', {
    original: messageContent.substring(0, 50) + (messageContent.length > 50 ? '...' : ''),
    generated: title
  });
  
  return title || "New conversation";
}

