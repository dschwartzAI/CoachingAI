'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { usePostHog } from '@/hooks/use-posthog';
import { getUserProfile } from '@/lib/utils/supabase';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileChecked, setProfileChecked] = useState(false);
  const router = useRouter();
  const { identify, reset } = usePostHog();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Helper function to get the correct URL for redirects
  const getURL = () => {
    // Get the site URL or deployment URL
    let url = process.env.NEXT_PUBLIC_SITE_URL || // Set in production environment
              typeof window !== 'undefined' ? window.location.origin : ''; // Fallback to origin in browser
              
    // Make sure to include `https://` when not localhost
    url = url.includes('localhost') ? url : url.startsWith('http') ? url : `https://${url}`;
    
    // Make sure to include a trailing `/`
    url = url.endsWith('/') ? url : `${url}/`;
    
    // Append the auth callback path
    return `${url}auth/callback`;
  };

  // Initialize the authentication state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // First, get the current session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          if (process.env.NODE_ENV !== "production") console.error('Error getting auth session:', error);
          setLoading(false);
          return;
        }
        
        // Set the user if we have a session
        setUser(session?.user || null);
        if (process.env.NODE_ENV !== "production") console.log('[Auth] Initial session:', session ? 'Active' : 'None');
        if (session) {
          if (process.env.NODE_ENV !== "production") console.log('[Auth] User ID:', session.user.id);
          // Identify user in PostHog on initial load
          identify(session.user.id, {
            email: session.user.email,
            user_id: session.user.id,
          });
        }
        
        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (process.env.NODE_ENV !== "production") console.log('[Auth] Auth state change:', event);
          setUser(session?.user ?? null);
          
          if (event === 'SIGNED_IN') {
            if (process.env.NODE_ENV !== "production") console.log('[Auth] User signed in:', session.user.id);
            // Identify user in PostHog
            identify(session.user.id, {
              email: session.user.email,
              user_id: session.user.id,
            });
            router.refresh();
          }
          
          if (event === 'SIGNED_OUT') {
            if (process.env.NODE_ENV !== "production") console.log('[Auth] User signed out');
            // Reset PostHog session
            reset();
            router.refresh();
          }
        });
        
        setLoading(false);
        return () => {
          subscription.unsubscribe();
        };
      } catch (err) {
        if (process.env.NODE_ENV !== "production") console.error('[Auth] Error initializing auth:', err);
        setLoading(false);
      }
    };
    
    initializeAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  useEffect(() => {
    const checkProfile = async () => {
      if (!user || profileChecked) return;

      try {
        const profile = await getUserProfile(user.id);
        if (!profile || !profile.business_name || !profile.business_type || !profile.target_audience || !profile.business_description) {
          router.replace('/profile');
        }
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') console.error('[Auth] Error fetching user profile:', err);
      } finally {
        setProfileChecked(true);
      }
    };

    checkProfile();
  }, [user, profileChecked, router]);

  useEffect(() => {
    if (!user) {
      setProfileChecked(false);
    }
  }, [user]);

  const value = {
    user,
    loading,
    signOut: async () => {
      try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        if (process.env.NODE_ENV !== "production") console.log('[Auth] User signed out successfully');
      } catch (err) {
        if (process.env.NODE_ENV !== "production") console.error('[Auth] Error signing out:', err);
        throw err;
      }
    },
    signInWithEmail: async (email, password) => {
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) {
          if (process.env.NODE_ENV !== "production") console.error('[Auth] Error signing in with email:', error.message);
          throw error;
        }
        
        if (process.env.NODE_ENV !== "production") console.log('[Auth] Email sign-in successful');
      } catch (err) {
        if (process.env.NODE_ENV !== "production") console.error('[Auth] Unexpected error during email sign-in:', err);
        throw err;
      }
    },
    signUpWithEmail: async (email, password) => {
      try {
        // Get redirect URL using the helper function
        const redirect = getURL();
        if (process.env.NODE_ENV !== "production") console.log('[Auth] Using redirect URL for email signup:', redirect);
            
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirect
          }
        });
        
        if (error) {
          if (process.env.NODE_ENV !== "production") console.error('[Auth] Error signing up with email:', error.message);
          throw error;
        }
        
        if (process.env.NODE_ENV !== "production") console.log('[Auth] Email sign-up initiated with redirect to:', redirect);
        return { success: true, message: 'Check your email for confirmation link' };
      } catch (err) {
        if (process.env.NODE_ENV !== "production") console.error('[Auth] Unexpected error during email sign-up:', err);
        throw err;
      }
    },
    signInWithGoogle: async () => {
      try {
        // Get redirect URL using the helper function
        const redirect = getURL();
        
        // Show the exact URL and domain being used
        if (process.env.NODE_ENV !== "production") console.log('[Auth] Current browser URL:', window.location.href);
        if (process.env.NODE_ENV !== "production") console.log('[Auth] Current origin:', window.location.origin);
        if (process.env.NODE_ENV !== "production") console.log('[Auth] Using redirect URL for Google:', redirect);
        
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            queryParams: {
              access_type: 'offline',
              prompt: 'consent',
            },
            redirectTo: redirect
          }
        });
        
        if (error) {
          if (process.env.NODE_ENV !== "production") console.error('[Auth] Error signing in with Google:', error.message);
          throw error;
        }
        
        if (process.env.NODE_ENV !== "production") console.log('[Auth] Google sign-in initiated');
        if (data?.url) {
          if (process.env.NODE_ENV !== "production") console.log('[Auth] OAuth URL:', data.url.substring(0, 100) + '...');
        }
      } catch (err) {
        if (process.env.NODE_ENV !== "production") console.error('[Auth] Unexpected error during Google sign-in:', err);
        throw err;
      }
    },
    // Expose direct methods for checking auth in case needed
    getSession: async () => {
      return await supabase.auth.getSession();
    },
    // Expose the supabase client for direct use if needed
    supabase
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 