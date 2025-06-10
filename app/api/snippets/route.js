import { createServerClientWithCookies } from '@/lib/utils/supabaseServer';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = createServerClientWithCookies();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('snippets')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ snippets: data });
}

export async function POST(request) {
  const supabase = createServerClientWithCookies();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { thread_id, message_id, content, note } = body;

  if (!thread_id || !message_id || !content) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ snippet: data });
}
