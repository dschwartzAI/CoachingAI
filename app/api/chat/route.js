import { OpenAI } from 'openai';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { TOOLS } from '@/lib/config/tools';
import { v4 as uuidv4 } from 'uuid';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const OPENAI_MODEL = "gpt-4o-mini";
// Add your GPT Assistant ID here
const GPT_ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID;

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

// Define the questions and their corresponding keys, in order
const hybridOfferQuestions = [
  { 
    key: 'offerDescription', 
    question: "What's your core product or service?",
    description: "Core product or service"
  },
  { 
    key: 'targetAudience', 
    question: "Who is your target audience?",
    description: "Target audience details"
  },
  { 
    key: 'painPoints', 
    question: "What pain points do they face?",
    description: "Customer pain points"
  },
  { 
    key: 'solution', 
    question: "How do you solve these problems?",
    description: "Solution approach"
  },
  { 
    key: 'pricing', 
    question: "What's your pricing structure?",
    description: "Pricing information"
  },
  { 
    key: 'clientResult', 
    question: "What's your best client result?",
    description: "Best client outcome"
  }
];

// Add a function to validate answers using AI
async function validateHybridOfferAnswer(questionKey, answer) {
  if (!answer || answer.trim().length < 5) {
    return {
      isValid: false,
      reason: "The answer is too short to provide meaningful information."
    };
  }

  // Create validation prompts based on question type
  const validationCriteria = {
    offerDescription: "Should describe a product or service with enough detail to understand what it is.",
    targetAudience: "Should describe who the offering is for - could be demographics, professions, or characteristics.",
    painPoints: "Should identify problems or challenges that the target audience experiences.",
    solution: "Should explain how the product/service addresses the pain points in a unique way.",
    pricing: "Should provide some indication of pricing structure, tiers, or general price range.",
    clientResult: "Should describe a success story or outcome that a client has achieved."
  };

  const validationPrompt = [
    {
      role: "system",
      content: `You are an assistant that validates answers for creating a hybrid offer.
You should determine if an answer provides sufficient information to proceed with offer creation.
Be flexible and accommodating - if the answer has ANY useful information, consider it valid.
Only reject answers that are completely off-topic, nonsensical, or too vague to use.
IMPORTANT: Err on the side of accepting answers unless they are clearly unusable.`
    },
    {
      role: "user",
      content: `Question category: ${questionKey}
Validation criteria: ${validationCriteria[questionKey]}
User's answer: "${answer}"

Is this answer useful enough to proceed with creating a hybrid offer? 
If not, briefly explain why in 1-2 sentences from a helpful perspective.
Return only JSON: { "isValid": boolean, "reason": "explanation if invalid" }`
    }
  ];

  try {
    // Call OpenAI to validate the answer
    const validationCompletion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: validationPrompt,
      temperature: 0.3, // Lower temperature for more consistent validation
      max_tokens: 150,
      response_format: { type: "json_object" }
    });

    // Parse the validation result
    const validationResult = JSON.parse(validationCompletion.choices[0].message.content);
    console.log(`[Chat API] Answer validation for ${questionKey}:`, validationResult);
    return validationResult;
  } catch (error) {
    console.error('[Chat API] Error validating answer:', error);
    // Default to accepting the answer if validation fails
    return { isValid: true, reason: null };
  }
}

// Add a function to calculate questions answered
function calculateQuestionsAnswered(collectedAnswers) {
  if (!collectedAnswers) return 0;
  
  // Count how many of the predefined questions have answers
  let count = 0;
  for (const question of hybridOfferQuestions) {
    if (collectedAnswers[question.key] && collectedAnswers[question.key].trim().length > 0) {
      count++;
    }
  }
  
  return count;
}

// Add this function to generate appropriate thread titles
function generateThreadTitle(message) {
  if (!message || !message.content) {
    return "New conversation";
  }
  
  // Truncate and clean the message to create a title
  const maxLength = 30;
  let title = message.content.trim();
  
  // Remove any newlines or extra whitespace
  title = title.replace(/\s+/g, ' ');
  
  if (title.length > maxLength) {
    // Cut at the last complete word within maxLength
    title = title.substr(0, maxLength).split(' ').slice(0, -1).join(' ') + '...';
  }
  
  console.log('[Chat API] Generated title from message:', {
    original: message.content.substring(0, 50) + (message.content.length > 50 ? '...' : ''),
    generated: title
  });
  
  return title || "New conversation";
}

export async function POST(request) {
  try {
    // Get the request body
    const body = await request.json();
    const { messages, tool, isToolInit, chatId: clientChatId } = body;
    
    let currentQuestionKey = body.currentQuestionKey || null; 
    const collectedAnswers = body.collectedAnswers || {};
    
    let chatId = clientChatId;
    if (!chatId || !isValidUUID(chatId)) {
      chatId = uuidv4();
      console.log(`[CHAT_API_DEBUG] ChatId validation failed: received="${clientChatId}", generated new UUID="${chatId}"`);
    } else {
      console.log(`[CHAT_API_DEBUG] ChatId validation passed: using existing UUID="${chatId}"`);
    }

    console.log('[CHAT_API_DEBUG] Request received:', { 
      messageCount: messages?.length || 0, 
      toolId: tool || 'none',
      isToolInit: isToolInit || false,
      chatId: chatId
    });

    if (!isToolInit && (!messages || !Array.isArray(messages) || messages.length === 0)) {
      return NextResponse.json(
        { error: 'Messages array cannot be empty for non-initialization calls' },
        { status: 400 }
      );
    }

    // SECTION 1: Handle tool initialization (especially for hybrid-offer)
    if (isToolInit && tool === 'hybrid-offer') {
      const initialSystemPrompt = `You are creating a hybrid offer for businesses. (concise prompt details...)`;
      const initialMessage = "What's your core product or service?";
      const existingAnswers = body.collectedAnswers || {};
      const questionsAnsweredOnInit = calculateQuestionsAnswered(existingAnswers);
      
      // Note: chatId here is the one from the client, which might be temporary.
      // The API will generate a permanent UUID if clientChatId was not a valid UUID.
      // We need to use the *final* chatId (permanent UUID) for DB operations.
      const finalChatIdForDB = isValidUUID(clientChatId) ? clientChatId : chatId; // chatId is already the potentially new UUID

      const initialMetadataForDB = {
        currentQuestionKey: 'offerDescription',
        questionsAnswered: 0,
        isComplete: false,
        // collectedAnswers should be empty at init, but let's ensure it is for metadata
        collectedAnswers: {}
      };

      const initResponsePayload = {
        message: initialMessage,
        currentQuestionKey: initialMetadataForDB.currentQuestionKey,
        collectedAnswers: { ...initialMetadataForDB.collectedAnswers }, // Send empty for client to start fresh
        questionsAnswered: initialMetadataForDB.questionsAnswered,
        isComplete: initialMetadataForDB.isComplete,
        chatId: finalChatIdForDB, // Send the permanent UUID back to the client
        systemPrompt: initialSystemPrompt
      };

      // Attempt to save this new thread with its initial metadata to the database
      try {
        console.log(`[CHAT_API_DEBUG] Attempting to save new thread for tool init. Chat ID: ${finalChatIdForDB}`);
        const { data: existingThread, error: lookupError } = await supabase
          .from('threads')
          .select('id')
          .eq('id', finalChatIdForDB)
          .single();

        if (lookupError && lookupError.code === 'PGRST116') { // Not found, so insert
          const toolDetails = TOOLS[tool];
          const threadTitle = toolDetails ? toolDetails.name : 'Hybrid Offer Chat'; // Default title
          
          const { error: insertError } = await supabase
            .from('threads')
            .insert({
              id: finalChatIdForDB,
              user_id: userId, // Ensure userId is available here
              tool_id: tool,
              title: threadTitle,
              metadata: initialMetadataForDB
            });

          if (insertError) {
            console.error('[CHAT_API_DEBUG] Error inserting new thread during tool init:', insertError);
            // Don't fail the whole request, but log the error. Client will have initial state.
          } else {
            console.log('[CHAT_API_DEBUG] New thread saved successfully during tool init:', finalChatIdForDB);
          }
        } else if (existingThread) {
          // Thread already exists, maybe update its metadata if it was a re-init attempt?
          // For now, let's assume init is for a new session. If it exists, metadata should already be there.
          console.log('[CHAT_API_DEBUG] Thread already existed during tool init, not re-inserting:', finalChatIdForDB);
        } else if (lookupError) {
          console.error('[CHAT_API_DEBUG] Error looking up thread during tool init:', lookupError);
        }
      } catch (dbSaveError) {
        console.error('[CHAT_API_DEBUG] DB exception during tool init thread save:', dbSaveError);
      }

      console.log('[CHAT_API_DEBUG] Sending initial hybrid offer response (tool init)');
      return NextResponse.json(initResponsePayload);
    }

    let userId = null;
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name) { return cookieStore.get(name)?.value; },
          set(name, value, options) { cookieStore.set({ name, value, ...options }); },
          remove(name, options) { cookieStore.set({ name, value: '', ...options }); },
        },
      }
    );
    
    if (process.env.NEXT_PUBLIC_SKIP_AUTH !== 'true') {
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      userId = session.user.id;
      console.log('[CHAT_API_DEBUG] Authentication successful:', { userId });
    } else {
      userId = 'dev-user-' + (chatId || uuidv4().substring(0, 8));
      console.log('[CHAT_API_DEBUG] Authentication check SKIPPED, using dev user ID:', userId);
    }

    // Save incoming USER message to DB & ensure thread exists
    if (chatId && messages && messages.length > 0) {
      try {
        let { data: existingThread, error: lookupError } = await supabase.from('threads').select('id, title, user_id, tool_id, metadata').eq('id', chatId).single();
        if (lookupError && lookupError.code === 'PGRST116') {
            console.log(`[CHAT_API_DEBUG] Thread not found, creating new: ${chatId}`);
            const firstUserMessage = messages.find(msg => msg.role === 'user');
            const threadTitle = firstUserMessage ? generateThreadTitle(firstUserMessage) : (tool ? TOOLS[tool]?.name || 'Tool Chat' : 'New conversation');
            const initialMetadata = tool === 'hybrid-offer' ? { currentQuestionKey: 'offerDescription', questionsAnswered: 0, isComplete: false } : null;
            const { data: newThread, error: threadError } = await supabase.from('threads').insert({ id: chatId, title: threadTitle, user_id: userId, tool_id: tool || null, metadata: initialMetadata }).select().single();
            if (threadError) console.error('[CHAT_API_DEBUG] Error creating thread:', threadError); else existingThread = newThread;
        } else if (lookupError) {
            console.error('[CHAT_API_DEBUG] Unexpected error looking up thread:', lookupError);
        } else {
            console.log('[CHAT_API_DEBUG] Thread found:', existingThread?.id);
        }

        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.content && lastMessage.role === 'user') {
            const { data: existingUserMsg, error: msgCheckError } = await supabase.from('messages').select('id').eq('thread_id', chatId).eq('content', lastMessage.content).eq('role', 'user').limit(1);
            if (msgCheckError) console.error('[CHAT_API_DEBUG] Error checking existing user message:', msgCheckError);
            if (!existingUserMsg || existingUserMsg.length === 0) {
                const { error: saveMsgError } = await supabase.from('messages').insert({ thread_id: chatId, role: lastMessage.role, content: lastMessage.content, timestamp: lastMessage.timestamp || new Date().toISOString() });
                if (saveMsgError) console.error('[CHAT_API_DEBUG] Error saving user message:', saveMsgError); else console.log('[CHAT_API_DEBUG] User message saved.');
            }
        }
      } catch (dbError) {
        console.error('[CHAT_API_DEBUG] DB error (user message/thread):', dbError);
      }
    }

    // SECTION 2: Determine AI's response content and tool-specific state
    let determinedAiResponseContent;
    let toolResponsePayload = null;

    if (tool === 'hybrid-offer') {
      console.log('[CHAT_API_DEBUG] Processing hybrid-offer tool logic (non-init path)');
      currentQuestionKey = body.currentQuestionKey || 'offerDescription';
      const currentQuestionsAnswered = calculateQuestionsAnswered(collectedAnswers);
      const totalQuestions = hybridOfferQuestions.length;

      // Prepare chat history for the prompt
      const recentHistoryMessages = messages.slice(-5); // Get last 5 messages
      let chatHistoryString = "No recent history available.";
      if (recentHistoryMessages.length > 0) {
        chatHistoryString = recentHistoryMessages.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n');
      }
      const latestUserMessageContent = messages.length > 0 ? messages[messages.length - 1].content : "";
      const currentQuestionDetails = hybridOfferQuestions.find(q => q.key === currentQuestionKey);
      const currentQuestionDescription = currentQuestionDetails?.description || 'the current topic';
      const currentQuestionText = currentQuestionDetails?.question || 'this aspect of your offer';


      let promptParts = [];
      promptParts.push("You are a friendly and cheeky helpful AI assistant guiding a user through creating a 'hybrid offer'. Your goal is to gather specific pieces of information by asking questions in a conversational manner.");
      promptParts.push("Your tone should be friendly, funny when appropriate, conversational, and engaging. Adapt your language based on the user's style in the chat history.");

      promptParts.push(`\nInformation collected so far for the hybrid offer (${currentQuestionsAnswered}/${totalQuestions} questions answered):`);
      hybridOfferQuestions.forEach((q, index) => {
        if (collectedAnswers[q.key]) {
          promptParts.push(`✓ ${index + 1}. ${q.description}: Answered`); // Don't show the answer itself to keep prompt shorter
        } else {
          promptParts.push(`◯ ${index + 1}. ${q.description}: Not yet discussed`);
        }
      });

      promptParts.push(`\nWe are currently focusing on: '${currentQuestionDescription}' (Key: ${currentQuestionKey}). The guiding question for this topic is: "${currentQuestionText}"`);

      promptParts.push(`\nRecent Conversation History (last 5 messages):`);
      promptParts.push(chatHistoryString);

      promptParts.push(`\n---`);
      promptParts.push(`Your Tasks based on the User's LATEST message ("${latestUserMessageContent}"):`);
      promptParts.push(`1. validAnswer (boolean): Is the user's latest message a relevant and sufficient answer for '${currentQuestionDescription}'? Apply reasonable judgment based on the specific question context.`);
      
      // Update the validation criteria to be more balanced
      promptParts.push(`   IMPORTANT - Balanced Validation Criteria: When evaluating if an answer is valid (validAnswer=true):
         * The answer must be relevant to the current question
         * Consider the context of previous exchanges - if the user has provided details across multiple messages, consider the cumulative information
         * If the user asks a question, you cannot consider it an answer. Example: "Do you think SaaS businesses are a good target audience for my offer?" is not an answer. Here you need to say your opinion, and if he then says "ok, let's say SaaS then", that is an answer.
         * Interpret industry-standard terms and services without requiring excessive explanation (e.g., "Google Ads management" is a known service type)
         * For each question type, these are SUFFICIENT examples:
            - offerDescription: "Google Ads management service" or "Social media content creation for small businesses" (basic service description is enough)
            - targetAudience: "Small business owners who don't have time for marketing" (a general description of who it's for)
            - painPoints: "They struggle to get consistent leads and don't know how to optimize ad spend" (basic problem statement)
            - solution: "We handle campaign creation, keyword research, and ongoing optimization" (general approach)
            - pricing: "Monthly retainer of $1000" or "15% of ad spend" (basic pricing model)
            - clientResult: "Doubled their conversion rate" or "Generated 50 new leads per month" (basic metric)
         * Only ask for more details if:
            1. The answer is completely off-topic from the question
            2. The answer is so vague it could apply to virtually any business (e.g., just saying "it's good")
            3. After 2-3 exchanges, you still don't have the basic information needed
         * Pay attention to user frustration - if they've repeated similar information multiple times, consider it valid and move on
         * When in doubt, ACCEPT the answer rather than frustrating the user with repeated requests`);
      
      promptParts.push(`2. savedAnswer (string): If validAnswer is true, extract or summarize the core information provided by the user for '${currentQuestionDescription}'. This will be saved. If validAnswer is false, this can be an empty string or null.`);
      promptParts.push(`3. isComplete (boolean): After considering the user's latest answer, are all ${totalQuestions} hybrid offer questions now answered (i.e., validAnswer was true for the *final* question, or all questions already had answers)?`);
      promptParts.push(`4. nextQuestionKey (string):`);
      promptParts.push(`   - If validAnswer is true AND isComplete is false: Determine the *key* of the *next* unanswered question from this list: ${hybridOfferQuestions.map(q => q.key).join(", ")}. The next question should be the first one in the sequence that hasn't been answered yet.`);
      promptParts.push(`   - If validAnswer is false: This should be the *current* currentQuestionKey (${currentQuestionKey}), as we need to re-ask or clarify.`);
      promptParts.push(`   - If isComplete is true: This can be null.`);
      promptParts.push(`5. responseToUser (string): This is your natural language response to the user. It will be shown directly to them.`);
      promptParts.push(`   - If validAnswer was true and isComplete is false: Briefly acknowledge their answer for '${currentQuestionDescription}'. Then, conversationally transition to ask about the topic of the nextQuestionKey. Refer to the chat history if it helps make your response more contextual.`);
      promptParts.push(`   - If validAnswer was false: Gently explain why more information or a different kind of answer is needed for '${currentQuestionDescription}'. Rephrase the request or ask clarifying questions. Avoid accusatory language.`);
      promptParts.push(`   - If isComplete is true: Acknowledge that all information has been gathered. Let them know the document generation process will begin (e.g., "Great, that's all the information I need for your hybrid offer! I'll start putting that together for you now.").`);
      promptParts.push(`   - General Guidance: Do NOT just state the next question from the list. Instead, weave it into a natural, flowing conversation. For example, instead of just 'What is your pricing?', you could say, 'Thanks for sharing that! Moving on, could you tell me a bit about your pricing structure?'. Don't say exactly this sentence every time, vary your responses, so it feels more natural conversationally.`);
      
      // Add the new section on conversational approach
      promptParts.push(`   - IMPORTANT - Natural Conversation Flow: Your primary goal is to have a natural conversation. When a user responds:
         1. First, genuinely engage with whatever they've shared - comment on it, ask follow-up questions if relevant, or share a brief insight
         2. Don't rush to get an answer to the next question in every response
         3. If they're discussing something off-topic, spend time engaging with that topic first
         4. Only after properly engaging, gently guide the conversation back toward the hybrid offer questions
         5. It's perfectly fine if it takes multiple exchanges to get back to the structured question flow
         6. Use phrases like "By the way...", "Speaking of which...", "That reminds me...", or "I'm also curious about..." when transitioning back to the questions
         7. If the user asks you questions, answer them honestly and thoroughly before gently returning to the offer structure
         8. Remember that building rapport is more important than rigidly following the question sequence`);
      
      promptParts.push(`---`);
      promptParts.push(`\nReturn ONLY a JSON object with the following structure (no other text before or after the JSON):`);
      promptParts.push(`{`);
      promptParts.push(`  "validAnswer": boolean,`);
      promptParts.push(`  "savedAnswer": string | null,`);
      promptParts.push(`  "nextQuestionKey": string | null,`);
      promptParts.push(`  "isComplete": boolean,`);
      promptParts.push(`  "responseToUser": string`);
      promptParts.push(`}`);
      const analyzingPrompt = promptParts.join('\n');
      
      // Use all messages for context to the AI, but the prompt focuses on the latest one for specific analysis.
      // The system prompt itself contains the instructions and context from collectedAnswers and history.
      const messagesForOpenAI = [
        { role: "system", content: analyzingPrompt },
        // Pass only the user's last message, as the system prompt already incorporates history and asks to analyze it.
        // Or, pass a few recent messages if the model handles that better for conversational flow, despite system prompt.
        // Let's try with the full message list for context, up to a reasonable limit.
        // The prompt guides the AI to focus on the LATEST user message for its structured output.
        ...messages 
      ];

      console.log('[CHAT_API_DEBUG] Sending analyzing prompt for hybrid-offer (conversational):', analyzingPrompt);
      console.log('[CHAT_API_DEBUG] Messages for OpenAI:', JSON.stringify(messagesForOpenAI.slice(-6))); // Log last few messages sent


      const analyzingCompletion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: messagesForOpenAI, // Pass the constructed messages
        temperature: 0.9, // Slightly higher for more conversational, but still focused
        response_format: { type: "json_object" }
      });
      
      const analysisResultString = analyzingCompletion.choices[0].message.content;
      console.log('[CHAT_API_DEBUG] Raw analysisResult string:', analysisResultString);
      const analysisResult = JSON.parse(analysisResultString);
      console.log('[CHAT_API_DEBUG] Conversational Analysis result:', analysisResult);
      
      determinedAiResponseContent = analysisResult.responseToUser;
      const tempCollectedAnswers = { ...collectedAnswers };
      
      const currentKeyForSaving = hybridOfferQuestions.find(q => q.key === currentQuestionKey)?.key || currentQuestionKey;


      if (analysisResult.validAnswer && analysisResult.savedAnswer) {
        tempCollectedAnswers[currentKeyForSaving] = analysisResult.savedAnswer;
      }
      
      const finalQuestionsAnswered = calculateQuestionsAnswered(tempCollectedAnswers);
      let finalNextQuestionKey = analysisResult.nextQuestionKey;
      let finalIsComplete = analysisResult.isComplete;

      // If the AI indicates completion, ensure response reflects that.
      // The AI is prompted to create this message, so analysisResult.responseToUser should be appropriate.
      if (finalIsComplete) {
        finalNextQuestionKey = null; // Ensure this is null if complete
         // Potentially override with a very specific message if needed, but ideally AI handles this.
        // determinedAiResponseContent = "Thank you! I've collected all the information needed for your hybrid offer. Your document is being generated now.";
      } else if (analysisResult.validAnswer) {
        // Valid answer, not complete. AI's responseToUser should be asking the next question.
        // finalNextQuestionKey is already set by AI.
      } else {
        // Invalid answer. AI's responseToUser should be a re-prompt.
        // Ensure nextQuestionKey reflects current question if AI didn't explicitly set it.
        finalNextQuestionKey = finalNextQuestionKey || currentKeyForSaving;
      }
      
      toolResponsePayload = {
        message: determinedAiResponseContent,
        currentQuestionKey: finalNextQuestionKey,
        collectedAnswers: { ...tempCollectedAnswers },
        questionsAnswered: finalQuestionsAnswered,
        isComplete: finalIsComplete,
        chatId: chatId
      };

      // Log the constructed toolResponsePayload
      console.log('[CHAT_API_DEBUG] Constructed toolResponsePayload:', JSON.stringify(toolResponsePayload, null, 2));

    } else if (!tool) {
      console.log('[CHAT_API_DEBUG] Using GPT Assistant for regular chat');
      try {
        const thread = await openai.beta.threads.create();
        const threadId = thread.id;
        const latestUserMessage = messages[messages.length - 1].content;
        let messageWithContext = latestUserMessage;
        const { data: recentMessages, error: recentMessagesError } = await supabase.from('messages').select('role, content').eq('thread_id', chatId).order('timestamp', { ascending: false }).limit(5);
        if (!recentMessagesError && recentMessages && recentMessages.length > 1) {
            const contextMessages = recentMessages.slice(1, 5).reverse();
            if (contextMessages.length > 0) {
              let contextString = "For context, this is our chat history:";
              contextMessages.forEach(msg => { contextString += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}
`; });
              messageWithContext = `${latestUserMessage}${contextString}`;
            }
        }
        await openai.beta.threads.messages.create(threadId, { role: "user", content: messageWithContext });
        const run = await openai.beta.threads.runs.create(threadId, { assistant_id: GPT_ASSISTANT_ID });
        return NextResponse.json({
          message: "Your request is being processed. Assistant is thinking...",
          chatId: chatId, threadId: threadId, runId: run.id, status: "processing", isInitialResponse: true
        });
      } catch (error) {
        console.error('[CHAT_API_DEBUG] GPT Assistant error:', error);
        return NextResponse.json({ error: `Error with GPT Assistant: ${error.message}`, chatId }, { status: 500 });
      }

    } else { 
      console.log(`[CHAT_API_DEBUG] Calling OpenAI for generic tool: ${tool}`);
      const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL, messages: messages, temperature: 0.7, max_tokens: 1000,
      });
      determinedAiResponseContent = completion.choices[0].message.content;
      if (typeof determinedAiResponseContent !== 'string') {
        determinedAiResponseContent = JSON.stringify(determinedAiResponseContent);
      }
      console.log('[CHAT_API_DEBUG] Generic tool OpenAI response received.');
    }

    // SECTION 3: Save the assistant's response to the database
    if (typeof determinedAiResponseContent !== 'undefined' && chatId && supabase) {
      console.log('[CHAT_API_DEBUG] Preparing to save assistant message to DB.');
      let contentToSaveForDB = determinedAiResponseContent;

      const { data: existingAsstMsg, error: asstMsgCheckErr } = await supabase.from('messages').select('id').eq('thread_id', chatId).eq('content', contentToSaveForDB).eq('role', 'assistant').limit(1);
      if (asstMsgCheckErr) console.error('[CHAT_API_DEBUG] Error checking existing asst message:', asstMsgCheckErr);
      
      if (!existingAsstMsg || existingAsstMsg.length === 0) {
        const msgObj = { thread_id: chatId, role: 'assistant', content: contentToSaveForDB, timestamp: new Date().toISOString() };
        const { data: savedMsg, error: saveError } = await supabase.from('messages').insert(msgObj).select().single();
        if (saveError) console.error('[CHAT_API_DEBUG] Error saving asst message:', saveError); else console.log('[CHAT_API_DEBUG] Asst message saved:', { id: savedMsg?.id });
      } else {
        console.log('[CHAT_API_DEBUG] Asst message already exists, skipping save.');
      }

      if (tool === 'hybrid-offer' && toolResponsePayload) {
        console.log('[CHAT_API_DEBUG] Updating thread metadata for hybrid-offer (after saving message):', {
          chatId,
          questionsAnswered: toolResponsePayload.questionsAnswered,
          currentQuestionKey: toolResponsePayload.currentQuestionKey,
          isComplete: toolResponsePayload.isComplete,
          collectedAnswersCount: Object.keys(toolResponsePayload.collectedAnswers || {}).length 
        });
        const { error: threadUpdateError } = await supabase
          .from('threads')
          .update({
            metadata: {
              currentQuestionKey: toolResponsePayload.currentQuestionKey,
              questionsAnswered: toolResponsePayload.questionsAnswered,
              isComplete: toolResponsePayload.isComplete,
              collectedAnswers: toolResponsePayload.collectedAnswers 
            }
          })
          .eq('id', chatId);
        if (threadUpdateError) {
          console.error('[CHAT_API_DEBUG] Error updating thread metadata:', threadUpdateError);
        } else {
          console.log('[CHAT_API_DEBUG] Thread metadata updated successfully');
        }
      }
    }

    // SECTION 4: Prepare the final response to send to the client
    let finalResponsePayload;
    if (toolResponsePayload) {
        finalResponsePayload = toolResponsePayload;
    } else if (typeof determinedAiResponseContent !== 'undefined') {
        finalResponsePayload = {
            message: determinedAiResponseContent,
            currentQuestionKey: body.currentQuestionKey || null,
            collectedAnswers: { ...collectedAnswers },
            questionsAnswered: calculateQuestionsAnswered(collectedAnswers),
            isComplete: false,
            chatId: chatId
        };
    } else {
        console.error('[CHAT_API_DEBUG] Critical: No response determined. Fallback.');
        finalResponsePayload = {
            message: "An error occurred processing your request.",
            currentQuestionKey: body.currentQuestionKey || null,
            collectedAnswers: { ...collectedAnswers },
            questionsAnswered: calculateQuestionsAnswered(collectedAnswers),
            isComplete: false,
            chatId: chatId,
            error: true
        };
    }

    console.log('[CHAT_API_DEBUG] Sending final response to client:', { chatId: finalResponsePayload.chatId, msgPreview: finalResponsePayload.message?.substring(0,50) });
    return NextResponse.json(finalResponsePayload);

  } catch (error) {
    console.error('[CHAT_API_DEBUG] Unhandled error in API route:', { msg: error.message, stack: error.stack });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
  }
}

// Helper function to check if a string is a valid UUID
function isValidUUID(id) {
  if (!id) return false;
  
  // UUID v4 pattern
  const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidV4Pattern.test(id);
} 