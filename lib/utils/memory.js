import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Simplified coaching memory categories
const COACHING_CATEGORIES = ['goals', 'challenges', 'wins', 'preferences', 'context'];

export async function createSessionSummary(threadId, userId) {
  try {
    console.log('[MEMORY] Creating session summary for thread:', threadId);
    
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

/**
 * Create a memory summary from completed specialty tool data
 * @param {string} userId - User ID
 * @param {string} threadId - Thread ID where tool was used
 * @param {string} toolType - Type of tool ('hybrid-offer' or 'workshop-generator')
 * @param {Object} toolData - Collected answers from the tool
 */
export async function createToolMemorySummary(userId, threadId, toolType, toolData) {
  try {
    console.log('[MEMORY] Creating tool memory summary:', { userId, threadId, toolType, answerCount: Object.keys(toolData).length });
    
    // Format tool data for analysis
    let formattedData = '';
    if (toolType === 'hybrid-offer') {
      formattedData = `HYBRID OFFER CREATION:
Service Description: ${toolData.serviceDescription || 'Not provided'}
Target Client: ${toolData.targetClient || 'Not provided'}
Core Problem: ${toolData.coreProblem || 'Not provided'}
Unique Mechanism: ${toolData.uniqueMechanism || 'Not provided'}
Outcome Promise: ${toolData.outcomePromise || 'Not provided'}
Pricing Preference: ${toolData.pricingPreference || 'Not provided'}
Service Format: ${toolData.serviceFormat || 'Not provided'}
Timeline: ${toolData.timeline || 'Not provided'}`;
    } else if (toolType === 'workshop-generator') {
      formattedData = `WORKSHOP CREATION:
Workshop Topic: ${toolData.workshopTopic || 'Not provided'}
Target Audience: ${toolData.targetAudience || 'Not provided'}
Problem Addressed: ${toolData.problemAddressed || 'Not provided'}
Participant Outcomes: ${toolData.participantOutcomes || 'Not provided'}
Workshop Duration: ${toolData.workshopDuration || 'Not provided'}
Topics and Activities: ${toolData.topicsAndActivities || 'Not provided'}
Resources Provided: ${toolData.resourcesProvided || 'Not provided'}`;
    }

    // Use AI to extract coaching insights from tool data
    const analysisPrompt = `Analyze this business tool completion data and extract key coaching insights. Focus on what's most relevant for future coaching conversations.

${formattedData}

Extract insights in these categories:
- Goals: What business goals or outcomes does this person want?
- Challenges: What business challenges or pain points are evident?
- Wins: What strengths, expertise, or positive aspects are shown?
- Preferences: What preferences about business model, pricing, format are evident?
- Context: Other relevant business context for coaching

Return a JSON object with these 5 keys (goals, challenges, wins, preferences, context). Keep each insight concise but specific. If no clear insight for a category, use an empty string.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: analysisPrompt },
        { role: "user", content: "Please analyze this tool completion data." }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const insights = JSON.parse(completion.choices[0].message.content);
    
    // Save to coaching_memories table using the correct schema with category
    const memoryEntries = [];
    for (const [category, content] of Object.entries(insights)) {
      if (content && content.trim()) {
        memoryEntries.push({
          user_id: userId,
          thread_id: threadId,
          category: category,
          content: `${toolType.toUpperCase()}: ${content.trim()}`,
          session_date: new Date().toISOString()
        });
      }
    }

    if (memoryEntries.length > 0) {
      const { data, error } = await supabase
        .from('coaching_memories')
        .insert(memoryEntries)
        .select();

      if (error) {
        console.error('[MEMORY] Error saving tool memory:', error);
        return false;
      }

      console.log('[MEMORY] Tool memory summary created:', { entries: data.length, toolType });
      return true;
    }

    return false;

  } catch (error) {
    console.error('[MEMORY] Error in createToolMemorySummary:', error);
    return false;
  }
}

export async function getCoachingContext(userId) {
  try {
    console.log('[MEMORY] Retrieving coaching context for user:', userId);
    
    // Get recent coaching memories (last 10 entries)
    const { data: memories, error } = await supabase
      .from('coaching_memories')
      .select('category, content, session_date')
      .eq('user_id', userId)
      .order('session_date', { ascending: false })
      .limit(10);

    if (error) {
      console.error('[MEMORY] Error fetching coaching memories:', error);
      return '';
    }

    if (!memories || memories.length === 0) {
      console.log('[MEMORY] No coaching memories found for user');
      return '';
    }

    // Combine insights by category, giving more weight to recent memories
    const combinedInsights = {
      goals: [],
      challenges: [],
      wins: [],
      preferences: [],
      context: []
    };

    memories.forEach((memory, index) => {
      const weight = index < 3 ? 'recent' : 'earlier'; // Mark recent vs earlier memories
      const category = memory.category;
      
      if (combinedInsights[category]) {
        combinedInsights[category].push(`${memory.content} (${weight})`);
      }
    });

    // Format for coaching context
    let contextString = '\n--- COACHING MEMORY CONTEXT ---\n';
    
    if (combinedInsights.goals.length > 0) {
      contextString += `GOALS: ${combinedInsights.goals.join('; ')}\n`;
    }
    
    if (combinedInsights.challenges.length > 0) {
      contextString += `CHALLENGES: ${combinedInsights.challenges.join('; ')}\n`;
    }
    
    if (combinedInsights.wins.length > 0) {
      contextString += `WINS/STRENGTHS: ${combinedInsights.wins.join('; ')}\n`;
    }
    
    if (combinedInsights.preferences.length > 0) {
      contextString += `PREFERENCES: ${combinedInsights.preferences.join('; ')}\n`;
    }
    
    if (combinedInsights.context.length > 0) {
      contextString += `CONTEXT: ${combinedInsights.context.join('; ')}\n`;
    }
    
    contextString += '--- END MEMORY CONTEXT ---\n';
    
    console.log('[MEMORY] Coaching context generated, length:', contextString.length);
    return contextString;

  } catch (error) {
    console.error('[MEMORY] Error getting coaching context:', error);
    return '';
  }
}

export async function getMessageCount(threadId) {
  try {
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


