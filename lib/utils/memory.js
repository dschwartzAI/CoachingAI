import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

function createSupabaseClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies }
  );
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
    .from('memory_summaries')
    .select('summary')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data ? data.summary : null;
}

export async function upsertMemorySummary(userId, summaryText) {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from('memory_summaries')
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
    .from('memory_summaries')
    .delete()
    .eq('user_id', userId);
  if (summaryError) throw summaryError;
  return true;
}


