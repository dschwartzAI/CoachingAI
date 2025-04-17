'use client';

import { createContext, useContext, useState, useEffect } from 'react';
// Revert back to the direct named import
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'; 
import { useRouter } from 'next/navigation';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  // Log the environment variables RIGHT BEFORE creating the client
  console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log("Supabase Anon Key:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const [supabase] = useState(() => {
    // Add a try-catch here for more detailed error logging during creation
    try {
      // Use the direct named import again
      return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );
    } catch (error) {
      console.error("Error creating Supabase client:", error);
      // Return null or a placeholder if creation fails, although the type error might happen before this catch
      return null; 
    }
  });
  
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Ensure supabase client was created before proceeding
    if (!supabase) {
      console.error("Supabase client failed to initialize.");
      setLoading(false);
      return;
    }
    
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth event:', event);
        setUser(session?.user ?? null);
        setLoading(false);
        // Optional: Redirect on login/logout if needed
        // if (event === 'SIGNED_IN') router.push('/');
        // if (event === 'SIGNED_OUT') router.push('/login'); // Or wherever your login page is
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [supabase, router]);

  const value = {
    supabase,
    user,
    signInWithGoogle: async () => {
       console.log("Attempting Google Sign In..."); 
       if (!supabase) return console.error("Supabase client not initialized for signInWithGoogle");
       try {
         const { error } = await supabase.auth.signInWithOAuth({
           provider: 'google',
           options: {
             redirectTo: `${window.location.origin}/api/auth/callback`,
           },
         });
         if (error) {
            console.error('Supabase signInWithOAuth Error:', error.message);
         }
       } catch (err) {
          console.error('Error during signInWithOAuth call:', err);
       }
    },
    signOut: async () => {
       console.log("Attempting Sign Out...");
       if (!supabase) return console.error("Supabase client not initialized for signOut");
       try {
          const { error } = await supabase.auth.signOut();
          if (error) {
             console.error('Supabase signOut Error:', error.message);
          }
       } catch (err) {
          console.error('Error during signOut call:', err);
       } 
    },
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading ? children : <div>Loading...</div>} {/* Basic loading state */}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 