"use server"

import { createClient } from "@/lib/supabase/server"
import { auth } from "@/lib/auth"
import { ActionState } from "@/types"

/**
 * Save a user's profile information to the database
 */
export async function saveUserProfileAction(profile) {
  try {
    const supabase = createClient()
    const session = await auth()
    
    if (!session?.user) {
      return { 
        isSuccess: false, 
        message: "Authentication required"
      }
    }
    
    const userId = session.user.id
    
    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    
    if (existingProfile) {
      // Update existing profile
      const { error } = await supabase
        .from('user_profiles')
        .update({
          business_name: profile.businessName,
          business_type: profile.businessType,
          target_audience: profile.targetAudience,
          business_description: profile.businessDescription,
          goals: profile.goals,
          challenges: profile.challenges,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
      
      if (error) throw error
    } else {
      // Create new profile
      const { error } = await supabase
        .from('user_profiles')
        .insert({
          user_id: userId,
          business_name: profile.businessName,
          business_type: profile.businessType,
          target_audience: profile.targetAudience,
          business_description: profile.businessDescription,
          goals: profile.goals,
          challenges: profile.challenges,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      
      if (error) throw error
    }
    
    return {
      isSuccess: true,
      message: "Profile saved successfully",
      data: profile
    }
  } catch (error) {
    console.error("Error saving user profile:", error)
    return {
      isSuccess: false,
      message: error.message || "Failed to save profile"
    }
  }
}

/**
 * Get a user's profile information from the database
 */
export async function getUserProfileAction() {
  try {
    const supabase = createClient()
    const session = await auth()
    
    if (!session?.user) {
      return { 
        isSuccess: false, 
        message: "Authentication required", 
        data: null 
      }
    }
    
    const userId = session.user.id
    
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    
    if (error) throw error
    
    if (!profile) {
      return {
        isSuccess: true,
        message: "No profile found",
        data: null
      }
    }
    
    // Transform DB column names to camelCase for the frontend
    const transformedProfile = {
      businessName: profile.business_name || "",
      businessType: profile.business_type || "",
      targetAudience: profile.target_audience || "",
      businessDescription: profile.business_description || "",
      goals: profile.goals || "",
      challenges: profile.challenges || ""
    }
    
    return {
      isSuccess: true,
      message: "Profile retrieved successfully",
      data: transformedProfile
    }
  } catch (error) {
    console.error("Error retrieving user profile:", error)
    return {
      isSuccess: false,
      message: error.message || "Failed to retrieve profile",
      data: null
    }
  }
}

// Client-side wrappers for the server actions
export async function saveUserProfile(profile) {
  return saveUserProfileAction(profile)
}

export async function getUserProfile() {
  return getUserProfileAction()
} 