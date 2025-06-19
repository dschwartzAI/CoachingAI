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
      .select('full_name, occupation, current_mrr, desired_mrr, desired_hours, biggest_challenge, allow_memory, psychographic_brief, psychographic_brief_updated_at')
      .eq('user_id', user.id)
      .single()

    if (error) {
      console.error('[API /api/profile GET] Supabase query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[API /api/profile GET] Profile data retrieved:', {
      userId: user.id,
      hasPsychographicBrief: !!data?.psychographic_brief,
      briefLength: data?.psychographic_brief?.length || 0,
      updatedAt: data?.psychographic_brief_updated_at,
      fullData: data
    });

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
  const { full_name, occupation, current_mrr, desired_mrr, desired_hours, business_stage, biggest_challenge, primary_goal, allow_memory, psychographic_brief } = body

  // Prepare the update object
  const updateData = {
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
  };

  // Only update psychographic brief fields if provided
  if (psychographic_brief !== undefined) {
    updateData.psychographic_brief = psychographic_brief;
    // Update timestamp only if the brief content is being changed
    if (psychographic_brief) {
      updateData.psychographic_brief_updated_at = new Date().toISOString();
    } else {
      // If clearing the brief, also clear the timestamp
      updateData.psychographic_brief_updated_at = null;
    }
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(updateData, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ profile: data })
}
