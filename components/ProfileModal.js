'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { useAuth } from '@/components/AuthProvider';

export default function ProfileModal({ open, onOpenChange, onProfileComplete }) {
  const { user } = useAuth();

  const [fullName, setFullName] = useState('');
  const [occupation, setOccupation] = useState('');
  const [currentMrr, setCurrentMrr] = useState('');
  const [desiredMrr, setDesiredMrr] = useState('');
  const [desiredHours, setDesiredHours] = useState('');
  const [biggestChallenge, setBiggestChallenge] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch profile data when modal opens
  useEffect(() => {
    if (open && user) {
      fetchProfile();
    }
  }, [open, user]);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile');
      if (!res.ok) return;
      const data = await res.json();
      if (data.profile) {
        setFullName(data.profile.full_name || '');
        setOccupation(data.profile.occupation || '');
        setCurrentMrr(data.profile.current_mrr || '');
        setDesiredMrr(data.profile.desired_mrr || '');
        setDesiredHours(data.profile.desired_hours || '');
        setBiggestChallenge(data.profile.biggest_challenge || '');
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.error('Failed to load profile:', err);
    }
  };

  // Format currency input
  const formatCurrency = (value) => {
    // Remove all non-numeric characters except decimal point
    const numericValue = value.replace(/[^0-9.]/g, '');
    
    // Parse to number and format with commas
    const number = parseFloat(numericValue);
    if (isNaN(number)) return '';
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(number);
  };

  const handleCurrentMrrChange = (e) => {
    const formatted = formatCurrency(e.target.value);
    setCurrentMrr(formatted);
  };

  const handleMrrChange = (e) => {
    const formatted = formatCurrency(e.target.value);
    setDesiredMrr(formatted);
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
          current_mrr: currentMrr,
          desired_mrr: desiredMrr,
          desired_hours: desiredHours,
          biggest_challenge: biggestChallenge
        })
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save profile');
      }
      
      setSuccess('Profile saved successfully');
      
      // Check if profile is now complete
      const isComplete = fullName && occupation && desiredMrr && desiredHours && biggestChallenge;
      if (isComplete && onProfileComplete) {
        onProfileComplete();
      }
      
      // Close modal after a short delay to show success message
      setTimeout(() => {
        onOpenChange(false);
      }, 1000);
      
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.error('Error saving profile:', err);
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form state
    setError('');
    setSuccess('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Complete Your Profile</DialogTitle>
          <DialogDescription>
            Help us personalize your experience by completing your profile information.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input 
              id="fullName" 
              value={fullName} 
              onChange={(e) => setFullName(e.target.value)} 
              disabled={saving}
              placeholder="Your full name"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="occupation">What do you do?</Label>
            <Textarea 
              id="occupation" 
              value={occupation} 
              onChange={(e) => setOccupation(e.target.value)} 
              disabled={saving}
              placeholder="I help [your niche/avatar] [solve x problem]. Add as much detail as possible - describe your services, your ideal clients, the specific problems you solve, your unique approach, and the results you deliver. The more specific you are, the better we can tailor content for your business."
              className="min-h-24 resize-y"
              rows={4}
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="currentMrr">Current Monthly Recurring Revenue</Label>
            <Input 
              id="currentMrr" 
              value={currentMrr} 
              onChange={handleCurrentMrrChange} 
              disabled={saving}
              placeholder="$10,000"
              type="text"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="desiredMrr">Desired Monthly Recurring Revenue</Label>
            <Input 
              id="desiredMrr" 
              value={desiredMrr} 
              onChange={handleMrrChange} 
              disabled={saving}
              placeholder="$10,000"
              type="text"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="desiredHours">Desired Hours per Week</Label>
            <Input 
              id="desiredHours" 
              value={desiredHours} 
              onChange={(e) => setDesiredHours(e.target.value)} 
              disabled={saving}
              placeholder="40"
              type="number"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="biggestChallenge">Biggest Challenge</Label>
            <Textarea 
              id="biggestChallenge" 
              value={biggestChallenge} 
              onChange={(e) => setBiggestChallenge(e.target.value)} 
              disabled={saving}
              placeholder="Describe your biggest challenge"
              className="min-h-24 resize-y"
              rows={4}
            />
          </div>
          
          {error && <p className="text-sm text-center text-destructive">{error}</p>}
          {success && <p className="text-sm text-center text-green-500">{success}</p>}
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={saving || !fullName || !occupation || !currentMrr || !desiredMrr || !desiredHours || !biggestChallenge}
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </Button>
          </DialogFooter>
        </form>
        
        {user && (
          <div className="text-center text-sm text-muted-foreground mt-2 pt-2 border-t">
            Signed in as {user.email}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
} 