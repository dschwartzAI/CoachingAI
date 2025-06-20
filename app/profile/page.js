'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  const [psychographicBrief, setPsychographicBrief] = useState('');
  const [psychographicBriefUpdatedAt, setPsychographicBriefUpdatedAt] = useState('');
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
                  console.log('[Profile Page] Setting ideal client profile:', {
          hasBrief: !!data.profile.ideal_client_profile,
          briefLength: data.profile.ideal_client_profile?.length,
          updatedAt: data.profile.ideal_client_profile_updated_at
        });
        setPsychographicBrief(data.profile.ideal_client_profile || '');
        setPsychographicBriefUpdatedAt(data.profile.ideal_client_profile_updated_at || '');
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
          allow_memory: allowMemory,
          ideal_client_profile: psychographicBrief
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

  console.log('[Profile Page] Current state:', {
    psychographicBrief: psychographicBrief ? `${psychographicBrief.substring(0, 100)}...` : 'EMPTY',
    psychographicBriefUpdatedAt,
    briefLength: psychographicBrief?.length || 0
  });

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
                          {/* Ideal Client Profile Section */}
              <div className="grid gap-2 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <Label htmlFor="psychographicBrief">Ideal Client Profile</Label>
                {psychographicBriefUpdatedAt && (
                  <span className="text-xs text-muted-foreground">
                    Updated: {new Date(psychographicBriefUpdatedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              <Textarea
                id="psychographicBrief"
                value={psychographicBrief}
                onChange={(e) => setPsychographicBrief(e.target.value)}
                                  placeholder="Generate a comprehensive ideal client profile using the Ideal Client Extractor tool..."
                rows={6}
                disabled={saving}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/chat?tool=ideal-client-extractor')}
                  disabled={saving}
                >
                  Generate New Brief
                </Button>
                {psychographicBrief && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm('Clear your ideal client profile? This cannot be undone.')) {
                        setPsychographicBrief('');
                        setPsychographicBriefUpdatedAt('');
                      }
                    }}
                    disabled={saving}
                  >
                    Clear Brief
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                This brief is automatically used as context for other tools like the Daily Client Machine to create more targeted copy.
              </p>
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
