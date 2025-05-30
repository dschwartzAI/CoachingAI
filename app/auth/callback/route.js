import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const provider = requestUrl.searchParams.get('provider')
  
  if (process.env.NODE_ENV !== 'production') console.log(`[Auth Callback] Request URL: ${requestUrl.toString()}`);
  if (process.env.NODE_ENV !== 'production') console.log(`[Auth Callback] Origin: ${requestUrl.origin}`);
  if (process.env.NODE_ENV !== 'production') console.log(`[Auth Callback] Auth provider: ${provider || 'email'}`);
  if (process.env.NODE_ENV !== 'production') console.log(`[Auth Callback] Has code: ${!!code}`);

  if (code) {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name) {
            return cookieStore.get(name)?.value
          },
          set(name, value, options) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name, options) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )
    
    if (process.env.NODE_ENV !== 'production') console.log(`[Auth Callback] Exchanging code for session`);
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      if (process.env.NODE_ENV !== 'production') console.error(`[Auth Callback] Error exchanging code: ${error.message}`);
    } else {
      if (process.env.NODE_ENV !== 'production') console.log(`[Auth Callback] Successfully exchanged code for session`);
    }
  }

  // URL to redirect to after sign in process completes
  // Explicitly use the current origin without any query parameters
  const redirectUrl = requestUrl.origin;
  if (process.env.NODE_ENV !== 'production') console.log(`[Auth Callback] Redirecting to clean URL: ${redirectUrl}`);
  return NextResponse.redirect(redirectUrl)
} 