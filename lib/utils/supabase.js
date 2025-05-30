import { createBrowserClient } from '@supabase/ssr';
import { generateThreadTitle } from './thread';
import { v4 as uuidv4 } from 'uuid';

export const supabaseExports = {};

// Initialize Supabase client – wrapped in a tiny helper so we don't have to repeat the env vars
const createSupabaseClient = () => {
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
    if (process.env.NODE_ENV !== "production") console.error('[Supabase] No user ID provided for saveThread');
    throw new Error('User ID is required to save a thread');
  }
  
  // Ensure we have a valid title
  if (!thread.title) {
    if (process.env.NODE_ENV !== "production") console.warn('[Supabase] No title provided for thread, using default');
    thread.title = "New conversation";
  }
  
  if (process.env.NODE_ENV !== "production") console.log('[Supabase] Saving thread:', { 
    title: thread.title, 
    toolId: thread.tool_id, 
    userId: userId,
    hasMetadata: !!thread.metadata
  });
  
  const supabase = createSupabaseClient();
  
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
    if (process.env.NODE_ENV !== "production") console.error('[Supabase] Error saving thread:', threadError);
    
    // Add more detailed error information for debugging
    if (threadError.code === '42501') {
      if (process.env.NODE_ENV !== "production") console.error('[Supabase] This appears to be a Row Level Security (RLS) error.');
      if (process.env.NODE_ENV !== "production") console.error('[Supabase] Check if the user is properly authenticated and has the correct permissions.');
      
      // Check if we have an active session
      const { data: { session } } = await supabase.auth.getSession();
      if (process.env.NODE_ENV !== "production") console.error('[Supabase] Current session:', session ? 'Active' : 'None');
      if (session) {
        if (process.env.NODE_ENV !== "production") console.error('[Supabase] Session user ID:', session.user.id);
        if (process.env.NODE_ENV !== "production") console.error('[Supabase] Does it match provided user ID?', session.user.id === userId);
      }
    }
    
    throw threadError;
  }

  if (process.env.NODE_ENV !== "production") console.log('[Supabase] Thread saved successfully:', {
    threadId: savedThread.id,
    title: savedThread.title,
    hasMetadata: !!savedThread.metadata
  });
  return savedThread;
}

export async function saveMessage(message, userId) {
  if (!userId) {
    if (process.env.NODE_ENV !== "production") console.error('[Supabase] No user ID provided for saveMessage');
    throw new Error('User ID is required to save a message');
  }
  if (process.env.NODE_ENV !== "production") console.log('[Supabase] Saving message:', { 
    threadId: message.thread_id,
    role: message.role,
    contentLength: message.content?.length || 0,
    userId
  });
  const supabase = createSupabaseClient();
  // Create the message object that matches the database schema
  const messageObject = {
    thread_id: message.thread_id,
    content: message.content,
    role: message.role,
    user_id: userId,
    created_at: message.timestamp || new Date().toISOString()
  };
  // Save the message
  const { data: messageData, error: messageError } = await supabase
    .from('messages')
    .insert(messageObject)
    .select()
    .single();
  if (messageError) {
    if (process.env.NODE_ENV !== "production") console.error('[Supabase] Error saving message:', messageError);
    throw messageError;
  }
  if (process.env.NODE_ENV !== "production") console.log('[Supabase] Message saved successfully:', {
    messageId: messageData.id,
    threadId: messageData.thread_id
  });
  return messageData;
}

export async function initializeThread(thread, firstMessage, userId) {
  if (process.env.NODE_ENV !== "production") console.log('[Supabase] Initializing thread:', { 
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
      if (process.env.NODE_ENV !== "production") console.log('[Supabase] Generated title from first message:', {
        originalMessage: firstMessage.substring(0, 50) + (firstMessage.length > 50 ? '...' : ''),
        generatedTitle: thread.title,
        toolId: thread.tool_id
      });
    } else if (thread.tool_id) {
      // Fall back to tool name if no first message
      titleSource = 'tool_name';
      const tools = require('@/lib/config/tools').TOOLS;
      thread.title = tools[thread.tool_id]?.name || 'Tool Chat';
      if (process.env.NODE_ENV !== "production") console.log('[Supabase] No message provided, using tool name as title:', thread.title);
    } else {
      // Final fallback
      titleSource = 'default';
      thread.title = "New conversation";
      if (process.env.NODE_ENV !== "production") console.log('[Supabase] Using default title:', thread.title);
    }

    // For hybrid offer tool, initialize metadata if not already present
    if (thread.tool_id === 'hybrid-offer' && !thread.metadata) {
      thread.metadata = {
        currentQuestionKey: 'offerDescription',
        questionsAnswered: 0,
        isComplete: false
      };
      if (process.env.NODE_ENV !== "production") console.log('[Supabase] Initialized hybrid offer metadata for new thread');
    }

    // Save thread first, passing userId
    const savedThread = await saveThread(thread, userId);
    if (process.env.NODE_ENV !== "production") console.log('[Supabase] Thread saved in initializeThread:', {
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
    const savedMessage = await saveMessage(messageObj, userId);
    if (process.env.NODE_ENV !== "production") console.log('[Supabase] First message saved in initializeThread:', {
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
      if (process.env.NODE_ENV !== "production") console.warn('[Supabase] Thread title mismatch:', {
        actualTitle: completeThread.title,
        expectedTitle: generateThreadTitle(firstMessage)
      });
    }
    
    return completeThread;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error('[Supabase] Error initializing thread:', error);
    throw error;
  }
}

export async function getThreads(userId) {
  if (process.env.NODE_ENV !== "production") console.log('[Supabase] Fetching threads for user:', userId);
  
  const supabase = createSupabaseClient();
  
  // Get all threads for the user
  const { data: threads, error: threadsError } = await supabase
    .from('threads')
    .select(`
      *,
      messages:messages(*, created_at)
    `)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (threadsError) {
    if (process.env.NODE_ENV !== "production") console.error('[Supabase] Error fetching threads:', threadsError);
    throw threadsError;
  }

  // Process the threads to extract metadata
  if (threads && threads.length > 0) {
    threads.forEach(thread => {
      // Sort messages by created_at timestamp to ensure correct order
      if (thread.messages && thread.messages.length > 0) {
        thread.messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      }
      
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

  if (process.env.NODE_ENV !== "production") console.log('[Supabase] Threads fetched successfully:', {
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
  if (process.env.NODE_ENV !== "production") console.log('[Supabase] Fetching thread:', threadId);
  
  const supabase = createSupabaseClient();
  
  // Get a specific thread with all its messages
  const { data: thread, error: threadError } = await supabase
    .from('threads')
    .select(`
      *,
      messages:messages(*, created_at)
    `)
    .eq('id', threadId)
    .single();

  if (threadError) {
    if (process.env.NODE_ENV !== "production") console.error('[Supabase] Error fetching thread:', threadError);
    throw threadError;
  }

  // Sort messages by created_at timestamp to ensure correct order
  if (thread.messages && thread.messages.length > 0) {
    thread.messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }

  // Process the thread metadata for hybrid offer tool
  if (thread.tool_id === 'hybrid-offer' && thread.metadata) {
    if (process.env.NODE_ENV !== "production") console.log('[Supabase] Processing hybrid offer metadata:', thread.metadata);
    
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

  if (process.env.NODE_ENV !== "production") console.log('[Supabase] Thread fetched successfully:', {
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
  if (process.env.NODE_ENV !== "production") console.log('[Supabase] Setting up realtime subscription for thread:', threadId);
  
  const supabase = createSupabaseClient();
  
  // Subscribe to new messages in this thread
  const channel = supabase
    .channel(`thread:${threadId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `thread_id=eq.${threadId}`
    }, payload => {
      if (process.env.NODE_ENV !== "production") console.log('[Supabase] Received realtime message:', {
        messageId: payload.new.id,
        threadId: payload.new.thread_id,
        role: payload.new.role
      });
      callback(payload);
    })
    .subscribe();

  if (process.env.NODE_ENV !== "production") console.log('[Supabase] Realtime subscription set up successfully for thread:', threadId);
  return channel;
}

export async function deleteThread(threadId) {
  if (process.env.NODE_ENV !== "production") console.log('[Supabase] Deleting thread:', threadId);
  
  if (!threadId) {
    if (process.env.NODE_ENV !== "production") console.error('[Supabase] Cannot delete thread: No thread ID provided');
    throw new Error('Thread ID is required to delete a thread');
  }

  try {
    const supabase = createSupabaseClient();
    
    // First check if the thread exists
    const { data: existingThread, error: checkError } = await supabase
      .from('threads')
      .select('id, user_id')
      .eq('id', threadId)
      .single();
    
    if (checkError) {
      if (process.env.NODE_ENV !== "production") console.error('[Supabase] Error checking thread existence:', checkError);
      
      if (checkError.code === 'PGRST116') {
        if (process.env.NODE_ENV !== "production") console.error('[Supabase] Thread not found with ID:', threadId);
        throw new Error(`Thread with ID ${threadId} not found`);
      }
      
      throw checkError;
    }
    
    if (process.env.NODE_ENV !== "production") console.log('[Supabase] Found thread to delete:', existingThread);
    
    // Get current user session to verify permissions
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      if (process.env.NODE_ENV !== "production") console.error('[Supabase] No active session when attempting to delete thread');
    } else {
      if (process.env.NODE_ENV !== "production") console.log('[Supabase] Active session user ID:', session.user.id);
      if (process.env.NODE_ENV !== "production") console.log('[Supabase] Thread user ID:', existingThread.user_id);
      if (process.env.NODE_ENV !== "production") console.log('[Supabase] User authorized to delete?', session.user.id === existingThread.user_id);
    }
    
    // Now delete the thread
    const { error } = await supabase
      .from('threads')
      .delete()
      .eq('id', threadId);
      
    if (error) {
      if (process.env.NODE_ENV !== "production") console.error('[Supabase] Error deleting thread:', error);
      
      // Handle RLS errors specially
      if (error.code === '42501') {
        if (process.env.NODE_ENV !== "production") console.error('[Supabase] Row Level Security prevented thread deletion');
        if (process.env.NODE_ENV !== "production") console.error('[Supabase] This is likely a permissions issue - the current user may not be allowed to delete this thread');
        throw new Error('You do not have permission to delete this thread');
      }
      
      throw error;
    }
    
    if (process.env.NODE_ENV !== "production") console.log('[Supabase] Thread deleted successfully:', threadId);
    return true;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error('[Supabase] Deletion error details:', error);
    throw error;
  }
}

export async function getUserProfile(userId) {
  if (process.env.NODE_ENV !== "production") console.log('[Supabase] Fetching user profile for:', userId);

  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') {
      if (process.env.NODE_ENV !== "production") console.error('[Supabase] Error fetching user profile:', error);
      throw error;
    }
  }

  if (process.env.NODE_ENV !== "production") console.log('[Supabase] User profile fetched:', data);

  return data;
}
supabaseExports.getUserProfile = getUserProfile;

export async function upsertUserProfile(userId, data) {
  if (process.env.NODE_ENV !== "production") console.log('[Supabase] Upserting user profile for:', userId);

  const supabase = createSupabaseClient();

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .upsert({ user_id: userId, ...data }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) {
    if (process.env.NODE_ENV !== "production") console.error('[Supabase] Error upserting user profile:', error);
    throw error;
  }

  if (process.env.NODE_ENV !== "production") console.log('[Supabase] User profile upserted:', profile);

  return profile;
}

export async function saveMemory({ userId, threadId, content, type, embedding }) {
  if (!userId) {
    throw new Error('userId required');
  }
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from('user_memories')
    .insert({
      id: uuidv4(),
      user_id: userId,
      thread_id: threadId,
      content,
      type,
      embedding
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function searchMemories(userId, embeddingVector, k = 5) {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.rpc('match_user_memories', {
    query_embedding: embeddingVector,
    match_count: k,
    user_id: userId
  });
  if (error) throw error;
  return data;
}

export async function getMemorySummary(userId) {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from('user_memory_summaries')
    .select('summary')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data ? data.summary : null;
}

export async function upsertMemorySummary(userId, summaryText) {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from('user_memory_summaries')
    .upsert({ user_id: userId, summary: summaryText }, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function wipeMemories(userId) {
  const supabase = createSupabaseClient();
  const { error: memError } = await supabase
    .from('user_memories')
    .delete()
    .eq('user_id', userId);
  if (memError) throw memError;
  const { error: summaryError } = await supabase
    .from('user_memory_summaries')
    .delete()
    .eq('user_id', userId);
  if (summaryError) throw summaryError;
  return true;
}

export function isProfileComplete(profile) {
  if (!profile) return false;
  const required = ['full_name', 'occupation', 'desired_mrr', 'desired_hours'];
  return required.every((field) => !!profile[field]);
}

export async function isUserProfileComplete(userId) {
  const profile = await supabaseExports.getUserProfile(userId);
  return isProfileComplete(profile);
}

// ---------------------------------------------------------------------------
// Back-compat helper aliases – older parts of the codebase still expect
// `fetchThreads` to exist.  We now expose it as an alias to `getThreads` so the
// import works no matter which name is used.
// ---------------------------------------------------------------------------

export { getThreads as fetchThreads, supabaseExports };
