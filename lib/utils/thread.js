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
  // Truncate and clean the first message to create a title
  const maxLength = 50;
  let title = firstMessage.trim();
  
  if (title.length > maxLength) {
    // Cut at the last complete word within maxLength
    title = title.substr(0, maxLength).split(' ').slice(0, -1).join(' ') + '...';
  }
  
  return title;
} 