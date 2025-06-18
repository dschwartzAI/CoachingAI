'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from '@/components/AuthProvider';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { resetPassword, user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Allow both authenticated and unauthenticated users to access forgot password
  // useEffect(() => {
  //   if (user) {
  //     router.replace('/');
  //   }
  // }, [user, router]);

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    console.log('[ForgotPassword] Attempting to reset password for:', email);
    
    try {
      const result = await resetPassword(email);
      console.log('[ForgotPassword] Reset password result:', result);
      setSuccess(result.message);
      setEmail(''); // Clear the email field
    } catch (err) {
      console.error("[ForgotPassword] Password reset error:", err);
      setError(err.message || 'Failed to send password reset email.');
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while auth is initializing
  if (authLoading) {
    return (
      <div className="container mx-auto flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="grid gap-4 p-6">
            <div className="text-center">Loading...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl">Forgot Password</CardTitle>
          <CardDescription>
            Enter your email address and we'll send you a password reset link
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form onSubmit={handleResetPassword} className="grid gap-4">
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
             {error && <p className="text-sm text-center text-destructive">{error}</p>}
             {success && <p className="text-sm text-center text-green-600">{success}</p>}
             <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Button>
          </form>
        </CardContent>
         <CardFooter className="text-center text-sm text-muted-foreground">
           <div className="w-full text-center">
             Remember your password?{' '}
             <a href="/login" className="text-primary hover:underline">
               Back to login
             </a>
           </div>
         </CardFooter>
      </Card>
    </div>
  );
} 