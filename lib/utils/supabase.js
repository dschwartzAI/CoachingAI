import { createBrowserClient } from '@supabase/ssr';
import { generateThreadTitle } from './thread';

// Initialize Supabase client
const createClient = () => {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
};

export async function saveThread(thread) {
  const supabase = createClient();
  
  // Save the thread
  const { data: threadData, error: threadError } = await supabase
    .from('threads')
    .insert({
      title: thread.title,
      tool_id: thread.tool_id,
    })
    .select()
    .single();

  if (threadError) {
    console.error('Error saving thread:', threadError);
    throw threadError;
  }

  return threadData;
}

export async function saveMessage(threadId, content, role) {
  const supabase = createClient();
  
  // Save the message
  const { data: messageData, error: messageError } = await supabase
    .from('messages')
    .insert({
      thread_id: threadId,
      content,
      role,
    })
    .select()
    .single();

  if (messageError) {
    console.error('Error saving message:', messageError);
    throw messageError;
  }

  return messageData;
}

export async function initializeThread(thread, firstMessage) {
  try {
    // For regular chats, generate title from first message
    if (!thread.tool_id) {
      thread.title = generateThreadTitle(firstMessage);
    }

    // Save thread first
    const savedThread = await saveThread(thread);
    
    // Save the first message
    const savedMessage = await saveMessage(savedThread.id, firstMessage, 'user');

    // Return the complete thread with its first message
    return {
      ...savedThread,
      messages: [savedMessage],
      isTemporary: false
    };
  } catch (error) {
    console.error('Error initializing thread:', error);
    throw error;
  }
}

export async function getThreads(userId) {
  const supabase = createClient();
  
  // Get all threads for the user
  const { data: threads, error: threadsError } = await supabase
    .from('threads')
    .select(`
      *,
      messages (*)
    `)
    .order('updated_at', { ascending: false });

  if (threadsError) {
    console.error('Error fetching threads:', threadsError);
    throw threadsError;
  }

  return threads;
}

export async function getThread(threadId) {
  const supabase = createClient();
  
  // Get a specific thread with all its messages
  const { data: thread, error: threadError } = await supabase
    .from('threads')
    .select(`
      *,
      messages (*)
    `)
    .eq('id', threadId)
    .single();

  if (threadError) {
    console.error('Error fetching thread:', threadError);
    throw threadError;
  }

  return thread;
}

// Set up real-time subscriptions
export function subscribeToThread(threadId, callback) {
  const supabase = createClient();
  
  // Subscribe to new messages in this thread
  const subscription = supabase
    .channel(`thread:${threadId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `thread_id=eq.${threadId}`
    }, callback)
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
} 