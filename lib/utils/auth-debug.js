import { createBrowserClient } from '@supabase/ssr';

/**
 * A simple utility function to check authentication status
 * Can be called from the browser console for debugging
 */
export async function checkSupabaseAuth() {
  console.log('Checking Supabase authentication status...');
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  
  try {
    // Check if we have a session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error checking session:', error);
      return {
        isAuthenticated: false,
        error: error.message
      };
    }
    
    if (!session) {
      console.log('No active session found');
      return {
        isAuthenticated: false,
        message: 'No active session found'
      };
    }
    
    console.log('Active session found:');
    console.log('- User ID:', session.user.id);
    console.log('- Email:', session.user.email);
    console.log('- Provider:', session.user.app_metadata.provider);
    
    // Try a simple database query to confirm RLS is working
    console.log('Testing database access with RLS...');
    const { data, error: dbError } = await supabase
      .from('threads')
      .select('count(*)')
      .eq('user_id', session.user.id)
      .single();
      
    if (dbError) {
      console.error('Error querying database:', dbError);
      return {
        isAuthenticated: true,
        user: {
          id: session.user.id,
          email: session.user.email
        },
        databaseAccess: false,
        error: dbError.message
      };
    }
    
    console.log('Database query successful!', data);
    return {
      isAuthenticated: true,
      user: {
        id: session.user.id,
        email: session.user.email
      },
      databaseAccess: true,
      data
    };
  } catch (err) {
    console.error('Unexpected error:', err);
    return {
      isAuthenticated: false,
      error: err.message
    };
  }
}

// Make it available in the global scope for browser console debugging
if (typeof window !== 'undefined') {
  window.checkAuth = checkSupabaseAuth;
} 