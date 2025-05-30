import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function createSupabaseClient() {
  // Use service role for server-side memory operations
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

// Simplified coaching memory categories
const COACHING_CATEGORIES = ['goals', 'challenges', 'wins', 'preferences', 'context'];

export async function createSessionSummary(threadId, userId) {
  try {
    console.log('[MEMORY] Creating session summary for thread:', threadId);
    
    const supabase = createSupabaseClient();
    
    // Get recent messages from the thread (last 10)
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('role, content, timestamp')
      .eq('thread_id', threadId)
      .order('timestamp', { ascending: true })
      .limit(10);
    
    if (msgError) {
      console.error('[MEMORY] Error fetching messages:', msgError);
      return;
    }
    
    if (!messages || messages.length < 2) {
      console.log('[MEMORY] Not enough messages for summary');
      return;
    }
    
    // Create conversation context for analysis
    const conversationText = messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');
    
    // Extract coaching insights using AI
    const extractionPrompt = `
Analyze this coaching conversation and extract key insights about the client. Return JSON with these fields:
{
  "goals": ["any new or updated business/revenue goals mentioned"],
  "challenges": ["specific problems or obstacles they shared"], 
  "wins": ["successes, achievements, or progress mentioned"],
  "preferences": ["work style, communication preferences, or personal preferences"],
  "context": ["business context, industry, role, team size, experience level"]
}

Only include NEW, SPECIFIC information. Ignore generic statements. Focus on actionable coaching insights.

Conversation:
${conversationText}
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert at extracting coaching insights from conversations. Return only valid JSON.' },
        { role: 'user', content: extractionPrompt }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });
    
    const insights = JSON.parse(completion.choices[0].message.content);
    console.log('[MEMORY] Extracted insights:', insights);
    
    // Save insights to coaching_memories table
    const memoryEntries = [];
    for (const [category, items] of Object.entries(insights)) {
      if (Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          if (item && item.trim()) {
            memoryEntries.push({
              user_id: userId,
              thread_id: threadId,
              category: category,
              content: item.trim(),
              session_date: new Date().toISOString()
            });
          }
        }
      }
    }
    
    if (memoryEntries.length > 0) {
      const { error: insertError } = await supabase
        .from('coaching_memories')
        .insert(memoryEntries);
      
      if (insertError) {
        console.error('[MEMORY] Error saving memories:', insertError);
      } else {
        console.log(`[MEMORY] Saved ${memoryEntries.length} coaching insights`);
      }
    }
    
  } catch (error) {
    console.error('[MEMORY] Error in createSessionSummary:', error);
  }
}

export async function getCoachingContext(userId) {
  try {
    const supabase = createSupabaseClient();
    
    // Get recent coaching memories (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: memories, error } = await supabase
      .from('coaching_memories')
      .select('category, content')
      .eq('user_id', userId)
      .gte('session_date', thirtyDaysAgo.toISOString())
      .order('session_date', { ascending: false });
    
    if (error) {
      console.error('[MEMORY] Error fetching coaching context:', error);
      return '';
    }
    
    if (!memories || memories.length === 0) {
      return '';
    }
    
    // Group memories by category
    const grouped = {};
    memories.forEach(memory => {
      if (!grouped[memory.category]) grouped[memory.category] = [];
      grouped[memory.category].push(memory.content);
    });
    
    // Format for James's prompt
    const contextParts = [];
    if (grouped.goals?.length) contextParts.push(`Goals: ${grouped.goals.join(', ')}`);
    if (grouped.challenges?.length) contextParts.push(`Current Challenges: ${grouped.challenges.join(', ')}`);
    if (grouped.wins?.length) contextParts.push(`Recent Wins: ${grouped.wins.join(', ')}`);
    if (grouped.preferences?.length) contextParts.push(`Work Style: ${grouped.preferences.join(', ')}`);
    if (grouped.context?.length) contextParts.push(`Background: ${grouped.context.join(', ')}`);
    
    if (contextParts.length === 0) return '';
    
    return `\n\nCOACHING CONTEXT FOR THIS CLIENT:\n${contextParts.join('\n')}\n`;
    
  } catch (error) {
    console.error('[MEMORY] Error in getCoachingContext:', error);
    return '';
  }
}

export async function getMessageCount(threadId) {
  try {
    const supabase = createSupabaseClient();
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('thread_id', threadId);
    
    if (error) return 0;
    return count || 0;
  } catch (error) {
    return 0;
  }
}


