'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/components/AuthProvider';

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [occupation, setOccupation] = useState('');
  const [desiredMrr, setDesiredMrr] = useState('');
  const [desiredHours, setDesiredHours] = useState('');
  const [allowMemory, setAllowMemory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  // Fetch profile data when user loads
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/profile');
        if (!res.ok) return;
        const data = await res.json();
        if (data.profile) {
          setFullName(data.profile.full_name || '');
          setOccupation(data.profile.occupation || '');
          setDesiredMrr(data.profile.desired_mrr || '');
          setDesiredHours(data.profile.desired_hours || '');
          setAllowMemory(data.profile.allow_memory ?? false);
        }
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') console.error('Failed to load profile:', err);
      }
    };
    if (user) fetchProfile();
  }, [user]);

  const handleDownloadMemories = async () => {
    try {
      const res = await fetch('/api/memory');
      if (!res.ok) throw new Error('Failed to fetch memories');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'memories.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.error('Download memories failed:', err);
    }
  };

  const handleDeleteMemories = async () => {
    if (!confirm('Delete all memories?')) return;
    try {
      const res = await fetch('/api/memory', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete memories');
      setSuccess('Memories deleted');
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.error('Delete memories failed:', err);
      setError(err.message || 'Failed to delete memories');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          occupation,
          desired_mrr: desiredMrr,
          desired_hours: desiredHours,
          allow_memory: allowMemory
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save profile');
      }
      setSuccess('Profile saved successfully');
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.error('Error saving profile:', err);
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading || (!user && !loading)) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="container mx-auto flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl">Profile</CardTitle>
          <CardDescription>Update your profile information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={saving} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="occupation">Occupation</Label>
              <Input id="occupation" value={occupation} onChange={(e) => setOccupation(e.target.value)} disabled={saving} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="desiredMrr">Desired Monthly Recurring Revenue</Label>
              <Input id="desiredMrr" value={desiredMrr} onChange={(e) => setDesiredMrr(e.target.value)} disabled={saving} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="desiredHours">Desired Hours per Week</Label>
              <Input id="desiredHours" value={desiredHours} onChange={(e) => setDesiredHours(e.target.value)} disabled={saving} />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="allowMemory"
                type="checkbox"
                className="h-4 w-4"
                checked={allowMemory}
                onChange={(e) => setAllowMemory(e.target.checked)}
                disabled={saving}
              />
              <Label htmlFor="allowMemory">Allow coaching memory</Label>
            </div>
            {error && <p className="text-sm text-center text-destructive">{error}</p>}
            {success && <p className="text-sm text-center text-green-500">{success}</p>}
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? 'Saving...' : 'Save Profile'}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleDownloadMemories} disabled={saving}>
                Download memories
              </Button>
              <Button type="button" variant="destructive" onClick={handleDeleteMemories} disabled={saving}>
                Delete memories
              </Button>
            </div>
          </form>
        </CardContent>
        {user && (
          <CardFooter className="text-center text-sm text-muted-foreground">
            Signed in as {user.email}
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
