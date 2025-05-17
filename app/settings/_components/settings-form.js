"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/AuthProvider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { saveUserProfile, getUserProfile } from "@/actions/profile-actions"
import { Loader2 } from "lucide-react"

export default function SettingsForm() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState({
    businessName: "",
    businessType: "",
    targetAudience: "",
    businessDescription: "",
    goals: "",
    challenges: ""
  })

  useEffect(() => {
    async function loadProfile() {
      if (!user) return
      
      try {
        setLoading(true)
        const userProfile = await getUserProfile()
        
        if (userProfile.isSuccess && userProfile.data) {
          setProfile(userProfile.data)
        }
      } catch (error) {
        console.error("Error loading profile:", error)
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [user])

  const handleChange = (e) => {
    const { name, value } = e.target
    setProfile((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!user) {
      toast({
        title: "Not logged in",
        description: "You must be logged in to save settings",
        variant: "destructive"
      })
      return
    }
    
    try {
      setSaving(true)
      const result = await saveUserProfile(profile)
      
      if (result.isSuccess) {
        toast({
          title: "Settings saved",
          description: "Your business profile has been updated"
        })
      } else {
        throw new Error(result.message || "Failed to save profile")
      }
    } catch (error) {
      console.error("Error saving profile:", error)
      toast({
        title: "Error saving settings",
        description: error.message || "Something went wrong",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Business Profile</CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="businessName">Business Name</Label>
              <Input
                id="businessName"
                name="businessName"
                value={profile.businessName}
                onChange={handleChange}
                placeholder="Your business name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="businessType">Business Type</Label>
              <Input
                id="businessType"
                name="businessType"
                value={profile.businessType}
                onChange={handleChange}
                placeholder="e.g. Coaching, Consulting, Agency"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="targetAudience">Target Audience</Label>
            <Input
              id="targetAudience"
              name="targetAudience"
              value={profile.targetAudience}
              onChange={handleChange}
              placeholder="Who are your ideal clients?"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="businessDescription">Business Description</Label>
            <Textarea
              id="businessDescription"
              name="businessDescription"
              value={profile.businessDescription}
              onChange={handleChange}
              placeholder="Describe what your business does"
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="goals">Business Goals</Label>
            <Textarea
              id="goals"
              name="goals"
              value={profile.goals}
              onChange={handleChange}
              placeholder="What are your main business goals?"
              rows={2}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="challenges">Challenges</Label>
            <Textarea
              id="challenges"
              name="challenges"
              value={profile.challenges}
              onChange={handleChange}
              placeholder="What are your biggest business challenges?"
              rows={2}
            />
          </div>
        </CardContent>
        
        <CardFooter>
          <Button type="submit" disabled={saving} className="w-full sm:w-auto">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
} 