import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function saveMemory({ user_id, thread_id, content, embedding, memory_type }) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies }
  );

  const { error } = await supabase.from('memories').insert({
    user_id,
    thread_id,
    content,
    embedding,
    memory_type
  });

  if (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[saveMemory] Error inserting memory:', error);
    }
    throw error;
  }
}

