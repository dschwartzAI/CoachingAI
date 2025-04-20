import { createBrowserClient } from '@supabase/ssr';
import { generateThreadTitle } from './thread';

// Initialize Supabase client
const createClient = () => {
  // The createBrowserClient function automatically handles session management
  // by reading from cookies, so we don't need to explicitly pass session information
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
};

// Check if we should use development user ID
const shouldSkipAuth = () => {
  return process.env.NEXT_PUBLIC_SKIP_AUTH === 'true';
};

// Get dev user ID for testing (only used when NEXT_PUBLIC_SKIP_AUTH=true)
const getDevUserId = (customId = null) => {
  return customId || `dev-user-${Date.now().toString().substring(0, 8)}`;
};

export async function saveThread(thread, userId) {
  if (!userId) {
    console.error('[Supabase] No user ID provided for saveThread');
    throw new Error('User ID is required to save a thread');
  }
  
  console.log('[Supabase] Saving thread:', { 
    title: thread.title, 
    toolId: thread.tool_id, 
    userId: userId 
  });
  
  const supabase = createClient();
  
  // Save the thread
  const { data: threadData, error: threadError } = await supabase
    .from('threads')
    .insert({
      title: thread.title,
      tool_id: thread.tool_id,
      user_id: userId,
    })
    .select()
    .single();

  if (threadError) {
    console.error('[Supabase] Error saving thread:', threadError);
    
    // Add more detailed error information for debugging
    if (threadError.code === '42501') {
      console.error('[Supabase] This appears to be a Row Level Security (RLS) error.');
      console.error('[Supabase] Check if the user is properly authenticated and has the correct permissions.');
      
      // Check if we have an active session
      const { data: { session } } = await supabase.auth.getSession();
      console.error('[Supabase] Current session:', session ? 'Active' : 'None');
      if (session) {
        console.error('[Supabase] Session user ID:', session.user.id);
        console.error('[Supabase] Does it match provided user ID?', session.user.id === userId);
      }
    }
    
    throw threadError;
  }

  console.log('[Supabase] Thread saved successfully:', {
    threadId: threadData.id,
    title: threadData.title
  });
  return threadData;
}

export async function saveMessage(message) {
  console.log('[Supabase] Saving message:', { 
    threadId: message.thread_id,
    role: message.role,
    contentLength: message.content?.length || 0
  });
  
  const supabase = createClient();
  
  // Create the message object that matches the database schema
  const messageObject = {
    thread_id: message.thread_id,
    content: message.content,
    role: message.role,
    // Use created_at instead of timestamp to match the database schema
    created_at: message.timestamp || new Date().toISOString()
  };
  
  // Save the message
  const { data: messageData, error: messageError } = await supabase
    .from('messages')
    .insert(messageObject)
    .select()
    .single();

  if (messageError) {
    console.error('[Supabase] Error saving message:', messageError);
    throw messageError;
  }

  console.log('[Supabase] Message saved successfully:', {
    messageId: messageData.id,
    threadId: messageData.thread_id
  });
  return messageData;
}

export async function initializeThread(thread, firstMessage, userId) {
  console.log('[Supabase] Initializing thread:', { 
    toolId: thread.tool_id,
    userId: userId,
    firstMessageLength: firstMessage?.length || 0
  });
  
  try {
    // For regular chats, generate title from first message
    if (!thread.tool_id) {
      thread.title = generateThreadTitle(firstMessage);
      console.log('[Supabase] Generated title:', thread.title);
    }

    // Save thread first, passing userId
    const savedThread = await saveThread(thread, userId);
    console.log('[Supabase] Thread saved in initializeThread:', {
      threadId: savedThread.id,
      title: savedThread.title
    });
    
    // Create message object
    const messageObj = {
      thread_id: savedThread.id,
      content: firstMessage,
      role: 'user',
      timestamp: new Date().toISOString()
    };
    
    // Save the first message
    const savedMessage = await saveMessage(messageObj);
    console.log('[Supabase] First message saved in initializeThread:', {
      messageId: savedMessage.id,
      threadId: savedMessage.thread_id
    });

    // Return the complete thread with its first message
    return {
      ...savedThread,
      messages: [savedMessage],
      isTemporary: false
    };
  } catch (error) {
    console.error('[Supabase] Error initializing thread:', error);
    throw error;
  }
}

export async function getThreads(userId) {
  console.log('[Supabase] Fetching threads for user:', userId);
  
  const supabase = createClient();
  
  // Get all threads for the user
  const { data: threads, error: threadsError } = await supabase
    .from('threads')
    .select(`
      *,
      messages (*)
    `)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (threadsError) {
    console.error('[Supabase] Error fetching threads:', threadsError);
    throw threadsError;
  }

  console.log('[Supabase] Threads fetched successfully:', {
    count: threads?.length || 0,
    threads: threads?.map(t => ({
      id: t.id,
      title: t.title,
      messageCount: t.messages?.length || 0
    }))
  });
  return threads;
}

export async function getThread(threadId) {
  console.log('[Supabase] Fetching thread:', threadId);
  
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
    console.error('[Supabase] Error fetching thread:', threadError);
    throw threadError;
  }

  console.log('[Supabase] Thread fetched successfully:', {
    id: thread.id,
    title: thread.title,
    messageCount: thread.messages?.length || 0
  });
  return thread;
}

// Set up real-time subscriptions
export function subscribeToThread(threadId, callback) {
  console.log('[Supabase] Setting up realtime subscription for thread:', threadId);
  
  const supabase = createClient();
  
  // Subscribe to new messages in this thread
  const channel = supabase
    .channel(`thread:${threadId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `thread_id=eq.${threadId}`
    }, payload => {
      console.log('[Supabase] Received realtime message:', {
        messageId: payload.new.id,
        threadId: payload.new.thread_id,
        role: payload.new.role
      });
      callback(payload);
    })
    .subscribe();

  console.log('[Supabase] Realtime subscription set up successfully for thread:', threadId);
  return channel;
} 