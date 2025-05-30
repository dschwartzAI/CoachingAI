import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from 'npm:openai'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!
const MAX_ROWS = parseInt(Deno.env.get('MEMORY_ROWS') ?? '50')
const MODEL = 'gpt-3.5-turbo'

serve(async (req) => {
  const supabase = createClient(supabaseUrl, serviceKey, {
    global: { headers: { Authorization: `Bearer ${serviceKey}` } },
  })

  // get distinct user ids from user_memories
  const { data: users, error: userErr } = await supabase
    .from('user_memories')
    .select('user_id')

  if (userErr) {
    console.error('Error fetching users', userErr)
    return new Response('error', { status: 500 })
  }

  const userIds = [...new Set(users?.map((u: any) => u.user_id))]
  const openai = new OpenAI({ apiKey: openaiApiKey })

  for (const userId of userIds) {
    const { data: memories, error } = await supabase
      .from('user_memories')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(MAX_ROWS)

    if (error) {
      console.error('Error fetching memories for', userId, error)
      continue
    }

    const content = memories.map((m: any) => m.content).join('\n')

    const summaryResp = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content:
            'Summarize this user\'s recent behaviour in 800 tokens or less.',
        },
        { role: 'user', content },
      ],
      max_tokens: 800,
      temperature: 0.2,
    })

    const summary = summaryResp.choices?.[0]?.message?.content?.trim() || ''

    const { error: upsertErr } = await supabase.rpc('upsertMemorySummary', {
      userId,
      summary,
    })
    if (upsertErr) {
      console.error('upsertMemorySummary failed for', userId, upsertErr)
    }
  }

  return new Response('ok')
})
