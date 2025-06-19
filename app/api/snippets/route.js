import { createServerClientWithCookies } from '@/lib/utils/supabaseServer';
import { NextResponse } from 'next/server';

export async function GET() {
  console.log('[Snippets API] GET request received');
  
  const supabase = createServerClientWithCookies();
  const { data: { user } } = await supabase.auth.getUser();

  console.log('[Snippets API] User check:', { hasUser: !!user, userId: user?.id });

  if (!user) {
    console.log('[Snippets API] GET - Unauthorized, no user found');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Snippets API] Querying snippets for user:', user.id);

  const { data, error } = await supabase
    .from('snippets')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  console.log('[Snippets API] Query result:', { 
    hasData: !!data, 
    dataLength: data?.length, 
    error: error?.message 
  });

  if (error) {
    console.error('[Snippets API] GET - Database error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log('[Snippets API] Returning snippets:', data?.length || 0, 'items');
  return NextResponse.json({ snippets: data });
}

export async function POST(request) {
  console.log('[Snippets API] POST request received');
  
  const supabase = createServerClientWithCookies();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    console.log('[Snippets API] Unauthorized - no user found');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Snippets API] User authenticated:', user.id);

  const body = await request.json();
  console.log('[Snippets API] Request body:', body);
  
  const { thread_id, message_id, content, note } = body;

  if (!thread_id || !message_id || !content) {
    console.log('[Snippets API] Missing required fields:', { 
      hasThreadId: !!thread_id, 
      hasMessageId: !!message_id, 
      hasContent: !!content 
    });
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  console.log('[Snippets API] Attempting to insert snippet');

  const { data, error } = await supabase
    .from('snippets')
    .insert({
      user_id: user.id,
      thread_id,
      message_id,
      content,
      note
    })
    .select()
    .single();

  if (error) {
    console.error('[Snippets API] Database error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log('[Snippets API] Snippet saved successfully:', data.id);
  return NextResponse.json({ snippet: data });
}
