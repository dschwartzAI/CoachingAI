import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value
        },
        set(name, value, options) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name, options) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Get the current session
  const { data: { session }, error } = await supabase.auth.getSession()
  
  // Define public routes that don't require authentication
  const publicRoutes = ['/login', '/signup', '/forgot-password', '/reset-password', '/auth/callback', '/oauth2callback']
  const isPublicRoute = publicRoutes.some(route => request.nextUrl.pathname.startsWith(route))
  
  // Define API routes that should be protected
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/')
  const isProtectedApiRoute = isApiRoute && !request.nextUrl.pathname.startsWith('/api/auth/')
  
  // Check if anonymous chats are explicitly allowed
  const allowAnonymousChats = process.env.ALLOW_ANONYMOUS_CHATS === 'true'
  
  // If user is not authenticated and trying to access protected routes
  if (!session && !isPublicRoute) {
    // For API routes, return 401 unless anonymous chats are allowed
    if (isProtectedApiRoute && !allowAnonymousChats) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    // For page routes, redirect to login unless anonymous chats are allowed
    if (!isApiRoute && !allowAnonymousChats) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
      return NextResponse.redirect(loginUrl)
    }
  }
  
  // If user is authenticated and trying to access auth pages, redirect to home
  // Note: We allow forgot-password for authenticated users in case they want to change their password
  const authPages = ['/login', '/signup']
  if (session && authPages.includes(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
} 