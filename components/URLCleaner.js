'use client';

import { useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

/**
 * A component that cleans authentication-related URL parameters
 * by replacing the current URL without them
 */
export default function URLCleaner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check if we have auth-related query parameters to clean
    if (
      searchParams.has('code') || 
      searchParams.has('error') || 
      searchParams.has('provider')
    ) {
      // Log what we're removing
      console.log('[URLCleaner] Cleaning auth-related URL parameters');
      
      // Use history API to replace the current URL without refreshing the page
      const cleanURL = window.location.origin + pathname;
      window.history.replaceState({}, document.title, cleanURL);
    }
  }, [pathname, searchParams]);

  // This is a utility component that doesn't render anything
  return null;
} 