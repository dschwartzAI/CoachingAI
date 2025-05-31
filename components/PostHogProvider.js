"use client"

import { useEffect, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'

export function PostHogProvider({ children }) {
  useEffect(() => {
    // Add console logs to debug initialization
    console.log('[PostHog] Initializing with key:', process.env.NEXT_PUBLIC_POSTHOG_KEY ? 'Present' : 'Missing')
    console.log('[PostHog] Host:', process.env.NEXT_PUBLIC_POSTHOG_HOST)
    
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      console.error('[PostHog] NEXT_PUBLIC_POSTHOG_KEY is missing!')
      return
    }

    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      person_profiles: 'identified_only', // or 'always' to create profiles for anonymous users as well
      capture_pageview: false, // Disable automatic pageview capture, as we capture manually
      // Enable debug mode as recommended in PostHog docs
      loaded: (posthog) => {
        console.log('[PostHog] PostHog loaded successfully!')
        console.log('[PostHog] PostHog instance:', posthog)
        posthog.debug() // Enable debug mode as per PostHog documentation
        console.log('[PostHog] Debug mode enabled')
        
        // Manually trigger a pageview after PostHog is loaded
        const currentUrl = window.location.href
        console.log('[PostHog] Sending initial pageview after load:', currentUrl)
        posthog.capture('$pageview', {
          '$current_url': currentUrl,
          '$pathname': window.location.pathname
        })
      }
    })
    
    console.log('[PostHog] Initialization attempted')
  }, [])

  return (
    <PHProvider client={posthog}>
      <SuspendedPostHogPageView />
      {children}
    </PHProvider>
  )
}

function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const posthog = usePostHog()

  // Track pageviews
  useEffect(() => {
    console.log('[PostHog PageView] Effect triggered:', { 
      pathname: !!pathname, 
      hasPosthog: !!posthog,
      posthogHasCapture: typeof posthog?.capture === 'function'
    })
    
    if (pathname && posthog && typeof posthog.capture === 'function') {
      let url = window.origin + pathname
      if (searchParams.toString()) {
        url = url + "?" + searchParams.toString()
      }

      console.log('[PostHog PageView] Sending pageview for:', url)
      // Use posthog.capture directly instead of the track wrapper
      posthog.capture('$pageview', { 
        '$current_url': url,
        '$pathname': pathname
      })
      console.log('[PostHog PageView] Pageview sent successfully')
    } else {
      console.warn('[PostHog PageView] Not sending pageview:', { 
        pathname: !!pathname, 
        hasPosthog: !!posthog,
        posthogHasCapture: typeof posthog?.capture === 'function'
      })
    }
  }, [pathname, searchParams, posthog])

  return null
}

// Wrap PostHogPageView in Suspense to avoid the useSearchParams usage above
// from de-opting the whole app into client-side rendering
// See: https://nextjs.org/docs/messages/deopted-into-client-rendering
function SuspendedPostHogPageView() {
  return (
    <Suspense fallback={null}>
      <PostHogPageView />
    </Suspense>
  )
} 