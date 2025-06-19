import { createServerClientWithCookies } from '@/lib/utils/supabaseServer';
import { NextResponse } from 'next/server';

export async function GET() {
  console.log('[Test Snippets] Starting database test');
  
    const supabase = createServerClientWithCookies();
  
  try {
    // Test 1: Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('[Test Snippets] Auth test:', { 
      hasUser: !!user, 
      userId: user?.id, 
      authError: authError?.message 
    });

    if (!user) {
      return NextResponse.json({ 
        error: 'Not authenticated', 
        test: 'auth',
        details: authError?.message 
      }, { status: 401 });
    }

    // Test 2: Check if snippets table exists and is accessible
    const { data: tableTest, error: tableError } = await supabase
      .from('snippets')
      .select('count(*)', { count: 'exact', head: true });

    console.log('[Test Snippets] Table test:', { 
      tableError: tableError?.message,
      count: tableTest 
    });

    // Test 3: Try to get existing snippets
    const { data: snippets, error: selectError } = await supabase
      .from('snippets')
      .select('*')
      .eq('user_id', user.id)
      .limit(5);
    
    console.log('[Test Snippets] Select test:', { 
      selectError: selectError?.message,
      snippetCount: snippets?.length 
    });

    return NextResponse.json({ 
      success: true, 
      tests: {
        auth: { passed: true, userId: user.id },
        table: { 
          passed: !tableError, 
          error: tableError?.message,
          accessible: !tableError
        },
        select: { 
          passed: !selectError, 
          error: selectError?.message,
          snippetCount: snippets?.length || 0,
          snippets: snippets || []
        }
      }
    });

  } catch (error) {
    console.error('[Test Snippets] Unexpected error:', error);
    return NextResponse.json({ 
      error: 'Unexpected error', 
      details: error.message 
    }, { status: 500 });
  }
} 