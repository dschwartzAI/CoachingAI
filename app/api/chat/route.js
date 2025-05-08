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

      let promptParts = [];
      promptParts.push(`You are creating a hybrid offer.`);
      promptParts.push(`Be direct and concise. Avoid unnecessary words.`);
      promptParts.push(`\nInformation collected so far (${currentQuestionsAnswered}/6 questions answered):`);
      hybridOfferQuestions.forEach((q, index) => {
        const questionNumber = index + 1;
        if (collectedAnswers[q.key]) {
          promptParts.push(`✓ ${questionNumber}. ${q.description}: "${collectedAnswers[q.key]}"`);
        } else {
          promptParts.push(`◯ ${questionNumber}. ${q.description}: Not provided`);
        }
      });
      promptParts.push(`\nCurrent questions answered: ${currentQuestionsAnswered}`);
      promptParts.push(`Currently evaluating: ${currentQuestionKey} (${hybridOfferQuestions.find(q => q.key === currentQuestionKey)?.description || 'Unknown Question'})`);
      promptParts.push(`\nBased on the user's message:`);
      promptParts.push(`1. Is this a valid answer to the current question?`);
      promptParts.push(`2. If valid, what is the next question key from the list: ${hybridOfferQuestions.map(q => q.key).join(", ")}?`);
      promptParts.push(`\nCRITICAL INSTRUCTIONS:`);
      promptParts.push(`- Your "responseToUser" field is shown DIRECTLY to the user and EXACTLY as you write it.`);
      promptParts.push(`- The "responseToUser" must ONLY contain the EXACT next question text, or a re-prompt if the answer is invalid. NO other conversational text.`);
      promptParts.push(`- NO summaries of previous answers.`);
      promptParts.push(`- NO introductions like "Now, let me ask about..."`);
      promptParts.push(`- NO explanations or additional context.`);
      promptParts.push(`- NO acknowledgments of the user's answer.`);
      promptParts.push(`- If all questions are answered, responseToUser should be a completion message and isComplete should be true.`);
      promptParts.push(`\nReturn a JSON object with the following structure:`);
      promptParts.push(`{`);
      promptParts.push(`  "validAnswer": boolean,            // Was the user's answer to the current question valid and usable?`);
      promptParts.push(`  "savedAnswer": string,             // The user's answer, potentially summarized or extracted.`);
      promptParts.push(`  "nextQuestionKey": string,         // Key of the next question if the answer was valid and not complete. Else, current key or null if complete.`);
      promptParts.push(`  "isComplete": boolean,             // True if all questions are now answered.`);
      promptParts.push(`  "responseToUser": string           // The exact text to show the user (next question, re-prompt, or completion message).`);
      promptParts.push(`}`);
      const analyzingPrompt = promptParts.join('\n');
      
      const analyzingCompletion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [{ role: "system", content: analyzingPrompt }, ...messages.slice(-3)],
        temperature: 0.4,
        response_format: { type: "json_object" }
      });
      
      const analysisResult = JSON.parse(analyzingCompletion.choices[0].message.content);
      console.log('[CHAT_API_DEBUG] Analysis result:', { valid: analysisResult.validAnswer, nextKey: analysisResult.nextQuestionKey, responseLen: analysisResult.responseToUser?.length });
      
      determinedAiResponseContent = analysisResult.responseToUser;
      const tempCollectedAnswers = { ...collectedAnswers };
      const keyMapping = {
        'customerPainPoints': 'painPoints', 'solutionApproach': 'solution',
        'pricingInformation': 'pricing', 'clientResults': 'clientResult',
        'bestClientResult': 'clientResult', 'offerDescription': 'offerDescription',
        'targetAudience': 'targetAudience', 'painPoints': 'painPoints',
        'solution': 'solution', 'pricing': 'pricing', 'clientResult': 'clientResult'
      };
      const standardCurrentKey = keyMapping[currentQuestionKey] || currentQuestionKey;

      if (analysisResult.validAnswer && analysisResult.savedAnswer) {
        tempCollectedAnswers[standardCurrentKey] = analysisResult.savedAnswer;
      }
      
      const finalQuestionsAnswered = calculateQuestionsAnswered(tempCollectedAnswers);
      let finalNextQuestionKey = standardCurrentKey;
      let finalIsComplete = false;

      if (analysisResult.validAnswer) {
        if (finalQuestionsAnswered >= hybridOfferQuestions.length) {
          finalIsComplete = true;
          finalNextQuestionKey = null;
          determinedAiResponseContent = "Thank you! I've collected all the information needed for your hybrid offer. Your document is being generated now.";
        } else {
          finalNextQuestionKey = hybridOfferQuestions[finalQuestionsAnswered]?.key || null;
          if (finalNextQuestionKey) {
            determinedAiResponseContent = hybridOfferQuestions.find(q => q.key === finalNextQuestionKey)?.question || analysisResult.responseToUser;
          } else {
            determinedAiResponseContent = analysisResult.responseToUser;
            console.warn("[CHAT_API_DEBUG] Incomplete but no next question key found. Using AI's responseToUser.");
          }
        }
      } else {
        finalNextQuestionKey = standardCurrentKey;
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

      if (tool === 'hybrid-offer') {
        const MAX_HYBRID_QUESTION_LENGTH = 100;
        if (contentToSaveForDB.length > MAX_HYBRID_QUESTION_LENGTH) {
          console.log('[CHAT_API_DEBUG] Hybrid offer rsp too long, truncating for DB:', { len: contentToSaveForDB.length });
          const qMarkIdx = contentToSaveForDB.indexOf('?');
          if (qMarkIdx > 0 && qMarkIdx < MAX_HYBRID_QUESTION_LENGTH) {
            contentToSaveForDB = contentToSaveForDB.substring(0, qMarkIdx + 1);
          } else {
            contentToSaveForDB = contentToSaveForDB.substring(0, MAX_HYBRID_QUESTION_LENGTH);
          }
        }
        const prefixesToRemove = ["Great! ", "Now, ", "Thank you. ", "Thanks! ", "I see. ", "Understood. ", "Perfect. ", "Excellent. ", "Got it. ", "Next, ", "Okay. ", "OK. "];
        for (const prefix of prefixesToRemove) {
          if (contentToSaveForDB.startsWith(prefix)) {
            contentToSaveForDB = contentToSaveForDB.substring(prefix.length);
            console.log('[CHAT_API_DEBUG] Removed prefix for DB save:', { prefix });
            break; 
          }
        }
      }

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