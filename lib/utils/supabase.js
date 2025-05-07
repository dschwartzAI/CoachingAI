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
  
  // Ensure we have a valid title
  if (!thread.title) {
    console.warn('[Supabase] No title provided for thread, using default');
    thread.title = "New conversation";
  }
  
  console.log('[Supabase] Saving thread:', { 
    title: thread.title, 
    toolId: thread.tool_id, 
    userId: userId,
    hasMetadata: !!thread.metadata
  });
  
  const supabase = createClient();
  
  // Prepare thread data
  const threadData = {
    title: thread.title,
    tool_id: thread.tool_id,
    user_id: userId,
  };
  
  // Add metadata for tool threads if available
  if (thread.metadata) {
    threadData.metadata = thread.metadata;
  } else if (thread.tool_id === 'hybrid-offer') {
    // Initialize metadata for hybrid offer
    threadData.metadata = {
      currentQuestionKey: 'offerDescription',
      questionsAnswered: 0,
      isComplete: false
    };
  }
  
  // Save the thread
  const { data: savedThread, error: threadError } = await supabase
    .from('threads')
    .insert(threadData)
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
    threadId: savedThread.id,
    title: savedThread.title,
    hasMetadata: !!savedThread.metadata
  });
  return savedThread;
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
    firstMessageLength: firstMessage?.length || 0,
    initialTitle: thread.title,
    hasMetadata: !!thread.metadata
  });
  
  try {
    // Generate title from first message for all threads (both tool-based and regular)
    let titleSource = 'default';
    
    // Always try to generate a title from the first message
    if (firstMessage) {
      titleSource = 'first_message';
      const generatedTitle = generateThreadTitle(firstMessage);
      thread.title = generatedTitle;
      console.log('[Supabase] Generated title from first message:', {
        originalMessage: firstMessage.substring(0, 50) + (firstMessage.length > 50 ? '...' : ''),
        generatedTitle: thread.title,
        toolId: thread.tool_id
      });
    } else if (thread.tool_id) {
      // Fall back to tool name if no first message
      titleSource = 'tool_name';
      const tools = require('@/lib/config/tools').TOOLS;
      thread.title = tools[thread.tool_id]?.name || 'Tool Chat';
      console.log('[Supabase] No message provided, using tool name as title:', thread.title);
    } else {
      // Final fallback
      titleSource = 'default';
      thread.title = "New conversation";
      console.log('[Supabase] Using default title:', thread.title);
    }

    // For hybrid offer tool, initialize metadata if not already present
    if (thread.tool_id === 'hybrid-offer' && !thread.metadata) {
      thread.metadata = {
        currentQuestionKey: 'offerDescription',
        questionsAnswered: 0,
        isComplete: false
      };
      console.log('[Supabase] Initialized hybrid offer metadata for new thread');
    }

    // Save thread first, passing userId
    const savedThread = await saveThread(thread, userId);
    console.log('[Supabase] Thread saved in initializeThread:', {
      threadId: savedThread.id,
      title: savedThread.title,
      titleSource: titleSource,
      expectedTitle: !thread.tool_id ? generateThreadTitle(firstMessage) : thread.title,
      titleMatches: savedThread.title === thread.title,
      hasMetadata: !!savedThread.metadata
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
      threadId: savedMessage.thread_id,
      messageContent: savedMessage.content.substring(0, 30) + (savedMessage.content.length > 30 ? '...' : '')
    });

    // Return the complete thread with its first message and ensure title is correct
    const completeThread = {
      ...savedThread,
      messages: [savedMessage],
      isTemporary: false
    };
    
    // Process metadata fields for easier access in the frontend
    if (completeThread.tool_id === 'hybrid-offer' && completeThread.metadata) {
      if (completeThread.metadata.currentQuestionKey) {
        completeThread.currentQuestionKey = completeThread.metadata.currentQuestionKey;
      }
      
      if (completeThread.metadata.questionsAnswered !== undefined) {
        completeThread.questionsAnswered = completeThread.metadata.questionsAnswered;
      }
      
      if (completeThread.metadata.isComplete !== undefined) {
        completeThread.isComplete = completeThread.metadata.isComplete;
      }
    }
    
    // Double check that the title is correct for non-tool chats
    if (!thread.tool_id && completeThread.title !== generateThreadTitle(firstMessage)) {
      console.warn('[Supabase] Thread title mismatch:', {
        actualTitle: completeThread.title,
        expectedTitle: generateThreadTitle(firstMessage)
      });
    }
    
    return completeThread;
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

  // Process the threads to extract metadata
  if (threads && threads.length > 0) {
    threads.forEach(thread => {
      // Process metadata for hybrid offer tool threads
      if (thread.tool_id === 'hybrid-offer' && thread.metadata) {
        if (thread.metadata.currentQuestionKey) {
          thread.currentQuestionKey = thread.metadata.currentQuestionKey;
        }
        
        if (thread.metadata.questionsAnswered !== undefined) {
          thread.questionsAnswered = thread.metadata.questionsAnswered;
        }
        
        if (thread.metadata.isComplete !== undefined) {
          thread.isComplete = thread.metadata.isComplete;
        }
      }
    });
  }

  console.log('[Supabase] Threads fetched successfully:', {
    count: threads?.length || 0,
    threads: threads?.map(t => ({
      id: t.id,
      title: t.title,
      messageCount: t.messages?.length || 0,
      tool_id: t.tool_id,
      questionsAnswered: t.questionsAnswered
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

  // Process the thread metadata for hybrid offer tool
  if (thread.tool_id === 'hybrid-offer' && thread.metadata) {
    console.log('[Supabase] Processing hybrid offer metadata:', thread.metadata);
    
    // Extract metadata properties into thread object for easier access
    if (thread.metadata.currentQuestionKey) {
      thread.currentQuestionKey = thread.metadata.currentQuestionKey;
    }
    
    if (thread.metadata.questionsAnswered !== undefined) {
      thread.questionsAnswered = thread.metadata.questionsAnswered;
    }
    
    if (thread.metadata.isComplete !== undefined) {
      thread.isComplete = thread.metadata.isComplete;
    }
  }

  console.log('[Supabase] Thread fetched successfully:', {
    id: thread.id,
    title: thread.title,
    messageCount: thread.messages?.length || 0,
    hasMetadata: !!thread.metadata,
    currentQuestionKey: thread.currentQuestionKey,
    questionsAnswered: thread.questionsAnswered
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