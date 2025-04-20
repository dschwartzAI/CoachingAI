import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { debugSupabaseConnection } from '@/lib/utils/debug-supabase';

export async function GET() {
  try {
    const result = await debugSupabaseConnection();
    
    // Also try server-side connection
    const supabase = createClient();
    const { data: threadsData, error: threadsError } = await supabase
      .from('threads')
      .select('count(*)')
      .limit(1);
    
    return NextResponse.json({
      clientSide: result,
      serverSide: {
        success: !threadsError,
        error: threadsError?.message,
        data: threadsData
      },
      environmentVars: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set (redacted)' : 'Missing',
        key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set (redacted)' : 'Missing',
        skipAuth: process.env.NEXT_PUBLIC_SKIP_AUTH
      }
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        stack: error.stack
      }, 
      { status: 500 }
    );
  }
} 