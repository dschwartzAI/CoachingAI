import { createBrowserClient } from '@supabase/ssr';

export async function debugSupabaseConnection() {
  console.log('Debugging Supabase connection...');
  
  // 1. Check if environment variables are set
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  console.log('Environment Variables:');
  console.log('- NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Set ✓' : 'Missing ✗');
  console.log('- NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? 'Set ✓' : 'Missing ✗');
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables. Please check your .env.local file.');
    return {
      success: false,
      error: 'Missing environment variables',
      environmentVars: {
        urlSet: !!supabaseUrl,
        keySet: !!supabaseKey
      }
    };
  }
  
  try {
    // 2. Initialize Supabase client
    const supabase = createBrowserClient(supabaseUrl, supabaseKey);
    console.log('Supabase client initialized ✓');
    
    // 3. Test connection with a simple query
    const { data, error } = await supabase
      .from('threads')
      .select('count(*)')
      .limit(1);
    
    if (error) {
      console.error('Error connecting to Supabase database:', error);
      return {
        success: false,
        error: error.message,
        details: error
      };
    }
    
    console.log('Successfully connected to Supabase database ✓');
    console.log('Query result:', data);
    
    // 4. Check authentication state
    const { data: authData, error: authError } = await supabase.auth.getSession();
    
    if (authError) {
      console.error('Error checking authentication:', authError);
      return {
        success: true,
        dbConnection: true,
        authentication: {
          error: authError.message,
          details: authError
        }
      };
    }
    
    const isAuthenticated = !!authData?.session?.user;
    console.log('Authentication status:', isAuthenticated ? 'Authenticated ✓' : 'Not authenticated ✗');
    if (isAuthenticated) {
      console.log('User ID:', authData.session.user.id);
    }
    
    return {
      success: true,
      dbConnection: true,
      authentication: {
        isAuthenticated,
        session: authData.session
      }
    };
    
  } catch (error) {
    console.error('Unexpected error:', error);
    return {
      success: false,
      error: error.message,
      details: error
    };
  }
} 