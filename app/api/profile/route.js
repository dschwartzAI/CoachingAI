import { createServerClientWithCookies } from '@/lib/utils/supabaseServer'
import { NextResponse } from 'next/server'

function createSupabaseClient() {
  return createServerClientWithCookies()
}

export async function GET() {
  try {
    const supabase = createSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('full_name, occupation, current_mrr, desired_mrr, desired_hours, biggest_challenge, allow_memory')
      .eq('user_id', user.id)
      .single()

    if (error) {
      console.error('[API /api/profile GET] Supabase query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ profile: data })
  } catch (e) {
    console.error('[API /api/profile GET] Handler error:', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request) {
  const supabase = createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { full_name, occupation, current_mrr, desired_mrr, desired_hours, business_stage, biggest_challenge, primary_goal, allow_memory } = body

  const { data, error } = await supabase
    .from('user_profiles')
    .upsert({
      user_id: user.id,
      full_name,
      occupation,
      current_mrr,
      desired_mrr,
      desired_hours,
      business_stage,
      biggest_challenge,
      primary_goal,
      allow_memory
    }, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ profile: data })
}
