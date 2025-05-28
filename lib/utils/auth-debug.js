import { createBrowserClient } from '@supabase/ssr';

/**
 * A simple utility function to check authentication status
 * Can be called from the browser console for debugging
 */
export async function checkSupabaseAuth() {
  if (process.env.NODE_ENV !== "production") console.log('Checking Supabase authentication status...');
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  
  try {
    // Check if we have a session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      if (process.env.NODE_ENV !== "production") console.error('Error checking session:', error);
      return {
        isAuthenticated: false,
        error: error.message
      };
    }
    
    if (!session) {
      if (process.env.NODE_ENV !== "production") console.log('No active session found');
      return {
        isAuthenticated: false,
        message: 'No active session found'
      };
    }
    
    if (process.env.NODE_ENV !== "production") console.log('Active session found:');
    if (process.env.NODE_ENV !== "production") console.log('- User ID:', session.user.id);
    if (process.env.NODE_ENV !== "production") console.log('- Email:', session.user.email);
    if (process.env.NODE_ENV !== "production") console.log('- Provider:', session.user.app_metadata.provider);
    
    // Try a simple database query to confirm RLS is working
    if (process.env.NODE_ENV !== "production") console.log('Testing database access with RLS...');
    const { data, error: dbError } = await supabase
      .from('threads')
      .select('count(*)')
      .eq('user_id', session.user.id)
      .single();
      
    if (dbError) {
      if (process.env.NODE_ENV !== "production") console.error('Error querying database:', dbError);
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
    
    if (process.env.NODE_ENV !== "production") console.log('Database query successful!', data);
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
    if (process.env.NODE_ENV !== "production") console.error('Unexpected error:', err);
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