import { NextResponse } from 'next/server';
import { createServerClientWithCookies } from '@/lib/utils/supabaseServer';

const createSupabaseClient = () => {
  return createServerClientWithCookies();
};

export async function POST(request) {
  try {
    const { threadId, metadata } = await request.json();
    
    if (!threadId) {
      return NextResponse.json({ error: 'Thread ID is required' }, { status: 400 });
    }
    
    if (process.env.NODE_ENV !== "production") console.log('[Update Thread Metadata] Updating thread:', threadId, 'with metadata:', metadata);
    
    const supabase = createSupabaseClient();
    
    // First, try to find the thread
    const { data: existingThread, error: findError } = await supabase
      .from('threads')
      .select('id, metadata')
      .eq('id', threadId)
      .single();
    
    if (findError && findError.code !== 'PGRST116') {
      if (process.env.NODE_ENV !== "production") console.error('[Update Thread Metadata] Error finding thread:', findError);
      return NextResponse.json({ error: 'Failed to find thread' }, { status: 500 });
    }
    
    if (!existingThread) {
      if (process.env.NODE_ENV !== "production") console.log('[Update Thread Metadata] Thread not found, cannot create thread without required fields (title, user_id)');
      if (process.env.NODE_ENV !== "production") console.log('[Update Thread Metadata] This suggests the thread should have been created earlier in the process');
      return NextResponse.json({ 
        error: 'Thread not found and cannot be created without required fields',
        details: 'Thread should be created during the chat initialization process'
      }, { status: 404 });
    }
    
    // Merge the new metadata with existing metadata
    const updatedMetadata = { ...existingThread.metadata, ...metadata };
    
    // Update the thread metadata
    const { data, error } = await supabase
      .from('threads')
      .update({ 
        metadata: updatedMetadata,
        updated_at: new Date().toISOString()
      })
      .eq('id', threadId)
      .select()
      .single();
    
    if (error) {
      if (process.env.NODE_ENV !== "production") console.error('[Update Thread Metadata] Error updating thread metadata:', error);
      return NextResponse.json({ error: 'Failed to update thread metadata' }, { status: 500 });
    }
    
    if (process.env.NODE_ENV !== "production") console.log('[Update Thread Metadata] Thread metadata updated successfully:', data.id);
    return NextResponse.json({ success: true, thread: data });
    
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error('[Update Thread Metadata] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 