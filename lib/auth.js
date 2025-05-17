import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"

/**
 * Get the current user's authentication session
 * Returns null if not authenticated
 */
export async function auth() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

/**
 * Get the current user
 * Returns null if not authenticated
 */
export async function currentUser() {
  const session = await auth()
  return session?.user || null
} 