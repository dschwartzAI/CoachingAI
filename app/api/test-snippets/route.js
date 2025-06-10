import { createServerClientWithCookies } from '@/lib/utils/supabaseServer';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = createServerClientWithCookies();
    const { data: { user } } = await supabase.auth.getUser();

    console.log('[TEST-SNIPPETS] User:', user?.id);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', user: null }, { status: 401 });
    }

    // Test if snippets table exists and is accessible
    const { data, error, count } = await supabase
      .from('snippets')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id);

    console.log('[TEST-SNIPPETS] Query result:', { data, error, count });

    if (error) {
      return NextResponse.json({ 
        error: error.message, 
        code: error.code,
        details: error.details,
        hint: error.hint,
        user: user.id
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      snippets: data, 
      count,
      user: user.id,
      message: 'Snippets table is accessible'
    });

  } catch (err) {
    console.error('[TEST-SNIPPETS] Unexpected error:', err);
    return NextResponse.json({ 
      error: 'Unexpected error', 
      details: err.message 
    }, { status: 500 });
  }
} 