'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Initialize the authentication state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // First, get the current session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting auth session:', error);
          setLoading(false);
          return;
        }
        
        // Set the user if we have a session
        setUser(session?.user || null);
        console.log('[Auth] Initial session:', session ? 'Active' : 'None');
        if (session) {
          console.log('[Auth] User ID:', session.user.id);
        }
        
        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          console.log('[Auth] Auth state change:', event);
          setUser(session?.user ?? null);
          
          if (event === 'SIGNED_IN') {
            console.log('[Auth] User signed in:', session.user.id);
            router.refresh();
          }
          
          if (event === 'SIGNED_OUT') {
            console.log('[Auth] User signed out');
            router.refresh();
          }
        });
        
        setLoading(false);
        return () => {
          subscription.unsubscribe();
        };
      } catch (err) {
        console.error('[Auth] Error initializing auth:', err);
        setLoading(false);
      }
    };
    
    initializeAuth();
  }, [supabase, router]);

  const value = {
    user,
    loading,
    signOut: async () => {
      try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        console.log('[Auth] User signed out successfully');
      } catch (err) {
        console.error('[Auth] Error signing out:', err);
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
          console.error('[Auth] Error signing in with email:', error.message);
          throw error;
        }
        
        console.log('[Auth] Email sign-in successful');
      } catch (err) {
        console.error('[Auth] Unexpected error during email sign-in:', err);
        throw err;
      }
    },
    signUpWithEmail: async (email, password) => {
      try {
        // Simply use the current site URL dynamically
        const redirect = `${window.location.origin}/auth/callback`;
            
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirect
          }
        });
        
        if (error) {
          console.error('[Auth] Error signing up with email:', error.message);
          throw error;
        }
        
        console.log('[Auth] Email sign-up initiated with redirect to:', redirect);
        return { success: true, message: 'Check your email for confirmation link' };
      } catch (err) {
        console.error('[Auth] Unexpected error during email sign-up:', err);
        throw err;
      }
    },
    signInWithGoogle: async () => {
      try {
        // Simply use the current site URL dynamically
        const redirect = `https://tmurhhigvlarqqcyiwmq.supabase.co/auth/v1/callback`;
        // const redirect = `https://coachingai.netlify.app/auth/callback`;
        // const redirect = `${window.location.origin}/auth/callback`;
        
        // Show the exact URL and domain being used
        console.log('[Auth] Current browser URL:', window.location.href);
        console.log('[Auth] Current origin:', window.location.origin);
        console.log('[Auth] Using redirect URL for Google:', redirect);
        
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
          console.error('[Auth] Error signing in with Google:', error.message);
          throw error;
        }
        
        console.log('[Auth] Google sign-in initiated');
        if (data?.url) {
          console.log('[Auth] OAuth URL:', data.url.substring(0, 100) + '...');
        }
      } catch (err) {
        console.error('[Auth] Unexpected error during Google sign-in:', err);
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