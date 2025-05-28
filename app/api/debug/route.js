import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    // Setup Supabase client
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name) {
            return cookieStore.get(name)?.value;
          },
          set(name, value, options) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name, options) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );

    // Get all threads with their messages
    const { data: threads, error: threadsError } = await supabase
      .from('threads')
      .select(`
        *,
        messages (*)
      `)
      .order('updated_at', { ascending: false });

    if (threadsError) {
      console.error('Error fetching threads:', threadsError);
      return NextResponse.json(
        { error: 'Error fetching threads', details: threadsError },
        { status: 500 }
      );
    }

    // Get RLS policies
    const { data: threadPolicies, error: threadPoliciesError } = await supabase
      .rpc('get_policies', { table_name: 'threads' });

    const { data: messagePolicies, error: messagePoliciesError } = await supabase
      .rpc('get_policies', { table_name: 'messages' });

    return NextResponse.json({
      threadsCount: threads?.length || 0,
      threads: threads?.map(t => ({
        id: t.id,
        title: t.title,
        user_id: t.user_id,
        tool_id: t.tool_id,
        metadata: t.metadata,
        created_at: t.created_at,
        updated_at: t.updated_at,
        messageCount: t.messages?.length || 0,
        messages: t.messages
      })),
      rls: {
        threadPolicies: threadPolicies || [],
        threadPoliciesError: threadPoliciesError || null,
        messagePolicies: messagePolicies || [],
        messagePoliciesError: messagePoliciesError || null
      }
    });
  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
} 