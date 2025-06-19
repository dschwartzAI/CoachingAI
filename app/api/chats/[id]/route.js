import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function PATCH(request, { params }) {
  const { id } = params;
  try {
    const { title, hasCustomTitle } = await request.json();
    const { error } = await supabase
      .from('threads')
      .update({ title, has_custom_title: hasCustomTitle })
      .eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update chat title:', error);
    return NextResponse.json({ error: 'Failed to update chat title' }, { status: 500 });
  }
} 