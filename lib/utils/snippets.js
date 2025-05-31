import { createBrowserClient } from '@supabase/ssr';

// Initialize Supabase client
const createSupabaseClient = () => {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
};

// Save a new snippet
export async function saveSnippet(snippetData, userId = null) {
  // Get userId from parameter or from snippetData
  const effectiveUserId = userId || snippetData.userId;
  
  if (!effectiveUserId) {
    throw new Error('User ID is required to save a snippet');
  }

  const supabase = createSupabaseClient();

  const snippet = {
    user_id: effectiveUserId,
    title: snippetData.title,
    content: snippetData.content,
    note: snippetData.note || null,
    tag: snippetData.tag || null,
    source_type: snippetData.sourceType,
    source_id: snippetData.sourceId || null,
    source_context: snippetData.sourceContext || null,
    message_id: snippetData.messageId || null,
  };

  const { data, error } = await supabase
    .from('snippets')
    .insert(snippet)
    .select()
    .single();

  if (error) {
    console.error('[Snippets] Error saving snippet:', error);
    throw error;
  }

  console.log('[Snippets] Snippet saved successfully:', data.id);
  return data;
}

// Get all snippets for a user
export async function getUserSnippets(userId, options = {}) {
  if (!userId) {
    throw new Error('User ID is required to get snippets');
  }

  const supabase = createSupabaseClient();
  
  let query = supabase
    .from('snippets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  // Apply filters if provided
  if (options.tag) {
    query = query.eq('tag', options.tag);
  }

  if (options.sourceType) {
    query = query.eq('source_type', options.sourceType);
  }

  if (options.search) {
    query = query.or(`title.ilike.%${options.search}%,content.ilike.%${options.search}%,note.ilike.%${options.search}%`);
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Snippets] Error getting snippets:', error);
    throw error;
  }

  return data || [];
}

// Get a specific snippet by ID
export async function getSnippet(snippetId, userId) {
  if (!userId) {
    throw new Error('User ID is required to get snippet');
  }

  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from('snippets')
    .select('*')
    .eq('id', snippetId)
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('[Snippets] Error getting snippet:', error);
    throw error;
  }

  return data;
}

// Update a snippet
export async function updateSnippet(snippetId, updates, userId = null) {
  // For updates, try to get userId from updates object if not provided
  const effectiveUserId = userId || updates.userId;
  
  if (!effectiveUserId) {
    throw new Error('User ID is required to update snippet');
  }

  const supabase = createSupabaseClient();

  // Remove userId from updates to avoid column conflicts
  const cleanUpdates = { ...updates };
  delete cleanUpdates.userId;

  const { data, error } = await supabase
    .from('snippets')
    .update(cleanUpdates)
    .eq('id', snippetId)
    .eq('user_id', effectiveUserId)
    .select()
    .single();

  if (error) {
    console.error('[Snippets] Error updating snippet:', error);
    throw error;
  }

  console.log('[Snippets] Snippet updated successfully:', data.id);
  return data;
}

// Delete a snippet
export async function deleteSnippet(snippetId, userId = null) {
  // If userId is not provided as second parameter, we'll rely on RLS policies
  // This makes it more flexible for different calling patterns
  if (!userId) {
    // Try to get current user from auth if possible
    const supabase = createSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id;
  }
  
  if (!userId) {
    throw new Error('User ID is required to delete snippet');
  }

  const supabase = createSupabaseClient();

  const { error } = await supabase
    .from('snippets')
    .delete()
    .eq('id', snippetId)
    .eq('user_id', userId);

  if (error) {
    console.error('[Snippets] Error deleting snippet:', error);
    throw error;
  }

  console.log('[Snippets] Snippet deleted successfully:', snippetId);
  return true;
}

// Get unique tags for a user
export async function getUserSnippetTags(userId) {
  if (!userId) {
    throw new Error('User ID is required to get snippet tags');
  }

  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from('snippets')
    .select('tag')
    .eq('user_id', userId)
    .not('tag', 'is', null);

  if (error) {
    console.error('[Snippets] Error getting snippet tags:', error);
    throw error;
  }

  // Extract unique tags
  const tags = [...new Set(data.map(item => item.tag).filter(Boolean))];
  return tags;
}

// Get snippet count by source type for a user
export async function getSnippetStats(userId) {
  if (!userId) {
    throw new Error('User ID is required to get snippet stats');
  }

  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from('snippets')
    .select('source_type')
    .eq('user_id', userId);

  if (error) {
    console.error('[Snippets] Error getting snippet stats:', error);
    throw error;
  }

  // Count by source type
  const stats = data.reduce((acc, item) => {
    acc[item.source_type] = (acc[item.source_type] || 0) + 1;
    return acc;
  }, {});

  return {
    total: data.length,
    bySourceType: stats
  };
} 