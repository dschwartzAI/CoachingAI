const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function testSupabaseConnection() {
  console.log('Testing Supabase connection with environment variables:');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY exists:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  console.log('NEXT_PUBLIC_SKIP_AUTH:', process.env.NEXT_PUBLIC_SKIP_AUTH);
  
  const skipAuth = process.env.NEXT_PUBLIC_SKIP_AUTH === 'true';
  
  // Create Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  
  try {
    // First check for authentication if not skipping auth
    let userId = null;
    
    if (!skipAuth) {
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      
      if (authError) {
        console.error('Authentication error:', authError);
        return;
      }
      
      if (!session) {
        console.log('No authenticated session found.');
        console.log('Please run the app and sign in first, or set NEXT_PUBLIC_SKIP_AUTH=true and use dev_user');
        return;
      } else {
        console.log('Found existing session for user:', session.user.email);
        userId = session.user.id;
      }
    } else {
      // Using development user ID as in your API route
      userId = 'dev-user-' + Date.now().toString().substring(0, 8);
      console.log('Auth check skipped, using development user ID:', userId);
      
      // For development mode, let's try to disable RLS for this session
      // (This only works if the service role key is used, which is not recommended in production)
      console.log('Attempting a direct database operation with RLS disabled...');
    }
    
    if (!userId) {
      console.error('No user ID available. Cannot proceed.');
      return;
    }
    
    // For dev mode with skipAuth, we need to use service role to bypass RLS
    // IMPORTANT: This approach is only for development/testing
    if (skipAuth) {
      console.log('Testing an alternative approach to insert data directly...');
      
      // Method 1: Try direct SQL insertion with RPC if RLS is blocking
      // This requires a custom function set up in Supabase
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('dev_insert_thread', {
          thread_title: 'Test Thread ' + new Date().toISOString(),
          dev_user_id: userId,
          thread_tool_id: null
        });
        
        if (rpcError) {
          console.log('RPC method failed (likely not set up):', rpcError);
          console.log('Trying alternative approaches...');
        } else {
          console.log('Thread created via RPC:', rpcData);
          return;
        }
      } catch (e) {
        console.log('RPC method not available, trying alternative approach');
      }
      
      // Method 2: Suggest creating tables without RLS for development
      console.log('\nRecommendation for development mode:');
      console.log('1. In your Supabase dashboard, temporarily disable RLS for testing');
      console.log('2. Or create dev_threads and dev_messages tables without RLS');
      console.log('3. Or create a service_role function to bypass RLS');
      
      return;
    }
    
    // 1. Create a test thread
    console.log('Creating test thread...');
    const { data: thread, error: threadError } = await supabase
      .from('threads')
      .insert({
        title: 'Test Thread ' + new Date().toISOString(),
        user_id: userId,
        tool_id: null
      })
      .select()
      .single();
    
    if (threadError) {
      console.error('Error creating thread:', threadError);
      return;
    }
    
    console.log('Thread created successfully:', thread);
    
    // 2. Create a test message
    console.log('Creating test message...');
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        thread_id: thread.id,
        content: 'This is a test message',
        role: 'user',
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (messageError) {
      console.error('Error creating message:', messageError);
      return;
    }
    
    console.log('Message created successfully:', message);
    
    // 3. Query to confirm records exist
    const { data: threads, error: threadsError } = await supabase
      .from('threads')
      .select('*, messages(*)')
      .eq('id', thread.id)
      .single();
    
    if (threadsError) {
      console.error('Error fetching thread:', threadsError);
      return;
    }
    
    console.log('Thread with messages:', threads);
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testSupabaseConnection().catch(console.error); 