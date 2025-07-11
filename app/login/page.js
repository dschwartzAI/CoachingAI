'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from '@/components/AuthProvider';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { signInWithEmail, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (user) {
      router.replace('/');
    }
    
    // Check for success message from password reset
    const message = searchParams.get('message');
    if (message) {
      setSuccess(message);
      // Clear the URL parameter
      router.replace('/login', undefined, { shallow: true });
    }
  }, [user, router, searchParams]);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.error("Email login error:", err);
      setError(err.message || 'Failed to log in with email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Enter your email below to login
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form onSubmit={handleEmailLogin} className="grid gap-4">
             <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
             </div>
             <div className="grid gap-2">
                <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                  <a href="/forgot-password" className="text-sm text-primary hover:underline">
                    Forgot password?
                  </a>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
             </div>
             {error && <p className="text-sm text-center text-destructive">{error}</p>}
             {success && <p className="text-sm text-center text-green-600">{success}</p>}
             <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Logging in...' : 'Login with Email'}
              </Button>
          </form>
        </CardContent>
         <CardFooter className="text-center text-sm text-muted-foreground">
           <div className="w-full text-center">
             Don&apos;t have an account?{' '}
             <a href="/signup" className="text-primary hover:underline">
               Sign up
             </a>
           </div>
         </CardFooter>
      </Card>
    </div>
  );
}
