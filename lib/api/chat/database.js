export async function findThread(supabase, id) {
  return supabase
    .from('threads')
    .select('id, title, user_id, tool_id, metadata')
    .eq('id', id)
    .single();
}

export async function createThread(supabase, data) {
  return supabase
    .from('threads')
    .insert(data)
    .select()
    .single();
}

export async function saveMessage(supabase, message) {
  return supabase
    .from('messages')
    .insert(message)
    .select()
    .single();
}

export async function upsertThread(supabase, threadData) {
  const { data: existingThread, error: lookupError } = await findThread(supabase, threadData.id);
  if (lookupError && lookupError.code !== 'PGRST116') {
    throw lookupError;
  }
  if (!existingThread) {
    const { data: newThread, error } = await createThread(supabase, threadData);
    if (error) throw error;
    return newThread;
  }
  return existingThread;
}
