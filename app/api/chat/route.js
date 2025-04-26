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
    
    // Initialize response variables
    let responsePayload = null;
    let aiResponse = "I'm here to help you with your hybrid offer creation.";
    let currentQuestionKey = null;
    let isComplete = false;
    const collectedAnswers = body.collectedAnswers || {};
    
    // Generate a proper UUID if client did not provide one or provided a non-UUID format
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
      originalChatId: clientChatId || 'none',
      newChatId: chatId,
      clientProvidedValidUUID: !!clientChatId && isValidUUID(clientChatId),
      hasCollectedAnswers: Object.keys(collectedAnswers || {}).length > 0,
      collectedAnswerKeys: Object.keys(collectedAnswers || {})
    });

    // Verify messages array is not empty - BUT allow empty arrays for tool initialization
    if (!isToolInit && (!messages || !Array.isArray(messages) || messages.length === 0)) {
      console.log('[CHAT_API_DEBUG] Rejected: Empty messages array in non-init call');
      return NextResponse.json(
        { error: 'Messages array cannot be empty for non-initialization calls' },
        { status: 400 }
      );
    }

    // For tool initialization, we can simply return the first question directly
    if (isToolInit && tool === 'hybrid-offer') {
      const initialSystemPrompt = `You are creating a hybrid offer for businesses.
A hybrid offer combines digital and physical components at multiple price points.

Collect this information in a direct, concise manner:
1. Core product/service
2. Target audience
3. Pain points
4. Solution approach
5. Pricing structure
6. Best client result

Be brief and direct. No unnecessary explanations. One question at a time.`;

      console.log('[CHAT_API_DEBUG] Tool initialization request - sending system prompt and returning custom message');
      
      const initialMessage = "What's your core product or service?";
      
      // Preserve any existing collected answers (though typically there won't be any for initialization)
      const existingAnswers = body.collectedAnswers || {};
      console.log('[CHAT_API_DEBUG] Tool initialization with existing answers:', {
        hasExistingAnswers: Object.keys(existingAnswers).length > 0,
        existingKeys: Object.keys(existingAnswers)
      });
      
      // Set up the conversation context for future messages
      responsePayload = {
        message: initialMessage,
        currentQuestionKey: 'offerDescription',
        collectedAnswers: { ...existingAnswers }, // Make a copy to ensure we don't lose any data
        isComplete: false,
        chatId: chatId,
        systemPrompt: initialSystemPrompt
      };
      
      console.log('[CHAT_API_DEBUG] Sending initial hybrid offer response', {
        responsePayload: JSON.stringify({
          chatId: responsePayload.chatId,
          questionKey: responsePayload.currentQuestionKey,
          answersCount: Object.keys(responsePayload.collectedAnswers).length
        })
      });
      return NextResponse.json(responsePayload);
    }

    // Verify authentication - SKIP for development or when env variable is set
    let isAuthenticated = true;
    let userId = null;
    let supabase = null;
    
    // Setup Supabase client
    const cookieStore = cookies();
    supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name) {
            return cookieStore.get(name)?.value;
          },
          set(name, value, options) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name, options) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );
    
    // Only verify authentication if not explicitly skipped
    if (process.env.NEXT_PUBLIC_SKIP_AUTH !== 'true') {
      console.log('[CHAT_API_DEBUG] Verifying authentication...');

      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) {
        console.log('[CHAT_API_DEBUG] Authentication failed:', { error: authError?.message });
        isAuthenticated = false;
      } else {
        console.log('[CHAT_API_DEBUG] Authentication successful:', { userId: session.user.id });
        userId = session.user.id;
      }
      
      // Check if we have an authenticated session (unless skipped)
      if (!isAuthenticated) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    } else {
      console.log('[CHAT_API_DEBUG] Authentication check SKIPPED (NEXT_PUBLIC_SKIP_AUTH=true)');
      // Use a fixed development user ID for development mode
      userId = 'dev-user-' + (chatId || uuidv4().substring(0, 8));
      console.log('[CHAT_API_DEBUG] Using development user ID:', userId);
    }

    // Save thread and messages to Supabase if needed
    if (chatId && messages.length > 0) {
      try {
        console.log('[CHAT_API_DEBUG] Database operations starting for chat:', { 
          chatId,
          userId,
          messageCount: messages.length
        });
        
        console.log('[CHAT_API_DEBUG] Checking if thread exists:', { chatId });
        let { data: existingThread, error: lookupError } = await supabase
          .from('threads')
          .select('id, title, user_id, tool_id')
          .eq('id', chatId)
          .single();
        
        if (lookupError) {
          console.log(`[CHAT_API_DEBUG] Thread lookup error:`, { 
            error: lookupError.message,
            code: lookupError.code,
            chatId
          });
          
          // If it's a "not found" error, we'll create a new thread
          if (lookupError.code === 'PGRST116') {
            console.log(`[CHAT_API_DEBUG] Thread not found in database: ${chatId}, will create new thread`);
            
            // Only create a new thread for first-time message or explicit tool init
            const firstUserMessage = messages.find(msg => msg.role === 'user');
            const threadTitle = firstUserMessage 
              ? generateThreadTitle(firstUserMessage)
              : (tool ? TOOLS[tool]?.name || 'Tool Chat' : 'New conversation');
            
            console.log('[CHAT_API_DEBUG] Creating new thread with title:', {
              chatId,
              title: threadTitle,
              userId,
              toolId: tool || null
            });
            
            // Create the thread with proper UUID
            const { data: newThread, error: threadError } = await supabase
              .from('threads')
              .insert({
                id: chatId,
                title: threadTitle,
                user_id: userId,
                tool_id: tool || null,
              })
              .select()
              .single();
            
            if (threadError) {
              console.error('[CHAT_API_DEBUG] Error creating thread:', {
                error: threadError.message,
                code: threadError.code,
                chatId
              });
            } else {
              console.log('[CHAT_API_DEBUG] Thread created successfully:', {
                id: newThread.id,
                title: newThread.title
              });
              existingThread = newThread;
            }
          } else {
            // If it's some other error, log it but continue
            console.error('[CHAT_API_DEBUG] Unexpected error looking up thread:', lookupError);
          }
        } else {
          console.log(`[CHAT_API_DEBUG] Thread found in database:`, {
            id: existingThread.id, 
            title: existingThread.title,
            userId: existingThread.user_id,
            toolId: existingThread.tool_id
          });
        }

        // Check if we need to save the latest user message
        if (messages.length > 0) {
          const lastMessage = messages[messages.length - 1];
          
          // Only try to save if it's a user message (don't save system or assistant messages here)
          if (lastMessage && lastMessage.content && lastMessage.role === 'user') {
            console.log('[CHAT_API_DEBUG] Attempting to save user message:', {
              threadId: chatId,
              contentLength: lastMessage.content.length,
              role: lastMessage.role
            });
            
            // First, check if this message already exists (to avoid duplicates)
            const { data: existingMessages, error: messageCheckError } = await supabase
              .from('messages')
              .select('id, content')
              .eq('thread_id', chatId)
              .eq('content', lastMessage.content)
              .eq('role', 'user')
              .limit(1);
            
            if (messageCheckError) {
              console.error('[CHAT_API_DEBUG] Error checking for existing message:', {
                error: messageCheckError.message,
                code: messageCheckError.code
              });
            }
            
            // Only save if this exact message doesn't already exist
            if (!existingMessages || existingMessages.length === 0) {
              console.log('[CHAT_API_DEBUG] Message is new, saving to database');
              const messageObj = {
                thread_id: chatId,  // Using valid UUID
                role: lastMessage.role,
                content: lastMessage.content,
                timestamp: lastMessage.timestamp || new Date().toISOString()
              };
              
              const { data: savedMessage, error: messageError } = await supabase
                .from('messages')
                .insert(messageObj)
                .select()
                .single();
                
              if (messageError) {
                console.error('[CHAT_API_DEBUG] Error saving message:', {
                  error: messageError.message,
                  code: messageError.code,
                  threadId: chatId
                });
              } else {
                console.log('[CHAT_API_DEBUG] User message saved successfully:', {
                  messageId: savedMessage.id,
                  threadId: savedMessage.thread_id
                });
              }
            } else {
              console.log('[CHAT_API_DEBUG] Message already exists, skipping save:', {
                existingMessageId: existingMessages[0].id,
                threadId: chatId
              });
            }
          } else {
            console.log('[CHAT_API_DEBUG] Not saving message - either not a user message or missing content', {
              role: lastMessage?.role,
              hasContent: !!lastMessage?.content
            });
          }
        }
      } catch (dbError) {
        console.error('[CHAT_API_DEBUG] Database error:', {
          error: dbError.message,
          stack: dbError.stack,
          chatId
        });
        // Continue with the API call even if database operations fail
      }
    }

    console.log('[CHAT_API_DEBUG] Calling OpenAI with', {
      messageCount: messages.length,
      model: OPENAI_MODEL,
      chatId
    });
    
    // Log message details (careful with sensitive data)
    messages.forEach((msg, i) => {
      console.log(`[CHAT_API_DEBUG] Message ${i+1}:`, {
        role: msg.role, 
        contentLength: msg.content?.length || 0,
        contentPreview: msg.content?.substring(0, 30) + '...'
      });
    });
    
    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    console.log('[CHAT_API_DEBUG] OpenAI response received:', {
      status: completion.choices && completion.choices.length > 0 ? 'success' : 'no_choices',
      chatId,
      contentLength: completion.choices[0]?.message?.content?.length || 0
    });
    
    // Extract content, handling both string and object formats
    aiResponse = completion.choices[0].message.content;
    // For safety, ensure content is a string
    if (typeof aiResponse !== 'string') {
      console.log('[CHAT_API_DEBUG] Content is not a string, converting:', {
        aiResponseType: typeof aiResponse,
        convertedLength: JSON.stringify(aiResponse).length
      });
      aiResponse = JSON.stringify(aiResponse);
    }
    
    // Save the assistant's response to the database if we have a chatId
    if (chatId && supabase) {
      try {
        console.log('[CHAT_API_DEBUG] Checking if assistant response needs to be saved:', {
          chatId,
          responseLength: aiResponse.length
        });
        
        // Check if this assistant message already exists
        const { data: existingAssistantMessages, error: assistantMessageCheckError } = await supabase
          .from('messages')
          .select('id, content')
          .eq('thread_id', chatId)
          .eq('content', aiResponse)
          .eq('role', 'assistant')
          .limit(1);
        
        if (assistantMessageCheckError) {
          console.error('[CHAT_API_DEBUG] Error checking for existing assistant message:', {
            error: assistantMessageCheckError.message,
            code: assistantMessageCheckError.code,
            chatId
          });
        }
        
        // Only save if this exact message doesn't already exist
        if (!existingAssistantMessages || existingAssistantMessages.length === 0) {
          console.log('[CHAT_API_DEBUG] Assistant message is new, saving to database');
        
          const messageObj = {
            thread_id: chatId,  // Using valid UUID
            role: 'assistant',
            content: aiResponse,
            timestamp: new Date().toISOString()
          };
          
          const { data: savedMessage, error: messageError } = await supabase
            .from('messages')
            .insert(messageObj)
            .select()
            .single();
            
          if (messageError) {
            console.error('[CHAT_API_DEBUG] Error saving assistant message:', {
              error: messageError.message,
              code: messageError.code,
              chatId
            });
          } else {
            console.log('[CHAT_API_DEBUG] Assistant message saved successfully:', {
              messageId: savedMessage.id,
              threadId: savedMessage.thread_id
            });
          }
        } else {
          console.log('[CHAT_API_DEBUG] Assistant message already exists, skipping save:', {
            existingMessageId: existingAssistantMessages[0].id,
            threadId: chatId
          });
        }
      } catch (dbError) {
        console.error('[CHAT_API_DEBUG] Database error saving assistant message:', {
          error: dbError.message,
          stack: dbError.stack,
          chatId
        });
        // Continue with the response even if database operations fail
      }
    }
    
    // For hybrid offer, try to determine the current question key
    if (tool === 'hybrid-offer') {
      console.log('[CHAT_API_DEBUG] Processing hybrid-offer tool logic');
      console.log('[CHAT_API_DEBUG] Current collected answers:', {
        keys: Object.keys(collectedAnswers),
        count: Object.keys(collectedAnswers).length,
        chatId
      });
      
      // Create a default responsePayload that will be overridden if needed
      responsePayload = {
        message: "Preparing your hybrid offer details...",
        currentQuestionKey: body.currentQuestionKey || 'offerDescription',
        collectedAnswers,
        isComplete: false,
        chatId: chatId
      };
      
      // For regular messages, we'll use AI to figure out what information we have
      // and what we still need to collect
      currentQuestionKey = body.currentQuestionKey;

      // Build a system prompt that includes what we've collected so far
      let analyzingPrompt = `You are creating a hybrid offer.
Be direct and concise. Avoid unnecessary words.

Information collected so far:
`;

      // Add collected answers and what's still missing
      hybridOfferQuestions.forEach(q => {
        if (collectedAnswers[q.key]) {
          analyzingPrompt += `✓ ${q.description}: "${collectedAnswers[q.key]}"\n`;
        } else {
          analyzingPrompt += `◯ ${q.description}: Not provided\n`;
        }
      });

      analyzingPrompt += `
Based on the user's message:
1. Is this a valid answer to the current question (${currentQuestionKey})?
2. What question to ask next?

Rules:
- Be extremely concise. No fluff.
- Ask only the essential question.
- No explanations before or after questions.
- Focus on collecting information efficiently.

IMPORTANT: Use ONLY these exact keys for nextQuestionKey:
- offerDescription: Core product or service
- targetAudience: Target audience
- painPoints: Pain points they face
- solution: How you solve the problems
- pricing: Pricing structure
- clientResult: Best client result
- complete: When all questions are answered

Return a JSON object:
{
  "validAnswer": boolean,
  "savedAnswer": string,
  "nextQuestionKey": string,
  "responseToUser": string // Keep this very brief and direct
}`;

      // Call OpenAI to analyze the response and determine next steps
      console.log('[CHAT_API_DEBUG] Calling OpenAI to analyze hybrid offer response');
      const analyzingCompletion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: analyzingPrompt },
          // Include their previous response as context
          ...(messages.slice(-3).map(m => ({ role: m.role, content: m.content }))),
        ],
        temperature: 0.4,
        response_format: { type: "json_object" }
      });
      
      // Parse the analysis
      try {
        const analysisResult = JSON.parse(analyzingCompletion.choices[0].message.content);
        console.log('[CHAT_API_DEBUG] Analysis result:', {
          validAnswer: analysisResult.validAnswer,
          nextQuestionKey: analysisResult.nextQuestionKey,
          savedAnswerLength: analysisResult.savedAnswer?.length || 0,
          responseLength: analysisResult.responseToUser?.length || 0,
          chatId
        });
        
        // Add key mapping to handle inconsistent key naming from the AI
        const keyMapping = {
          // Map alternate keys to our standard keys
          'customerPainPoints': 'painPoints',
          'solutionApproach': 'solution',
          'pricingInformation': 'pricing',
          'clientResults': 'clientResult',
          'bestClientResult': 'clientResult',
          // also map standard keys to themselves
          'offerDescription': 'offerDescription',
          'targetAudience': 'targetAudience',
          'painPoints': 'painPoints',
          'solution': 'solution',
          'pricing': 'pricing',
          'clientResult': 'clientResult'
        };
        
        // Use the current question's standard key
        const standardCurrentKey = keyMapping[currentQuestionKey] || currentQuestionKey;
        
        // Update collected answers if we got a valid response
        if (analysisResult.validAnswer && analysisResult.savedAnswer) {
          // Save with the standard key
          collectedAnswers[standardCurrentKey] = analysisResult.savedAnswer;
          
          console.log(`[CHAT_API_DEBUG] Saved answer for ${standardCurrentKey}:`, {
            standardKey: standardCurrentKey,
            originalKey: currentQuestionKey,
            question: hybridOfferQuestions.find(q => q.key === standardCurrentKey)?.question,
            answerLength: analysisResult.savedAnswer.length,
            answersCount: Object.keys(collectedAnswers).length,
            answersList: Object.keys(collectedAnswers),
            chatId
          });
        }
        
        // Check if we're complete
        if (analysisResult.nextQuestionKey === "complete") {
          isComplete = true;
          console.log('[CHAT_API_DEBUG] All questions answered, marking as complete');
        }
        
        // Set the content to the AI's response
        aiResponse = analysisResult.responseToUser;
        
        // Determine the next question key (using standardized keys)
        let nextQuestionKey = standardCurrentKey;
        if (analysisResult.validAnswer) {
          if (analysisResult.nextQuestionKey === "complete") {
            nextQuestionKey = null;
          } else {
            // Map AI's next question key to our standard keys
            nextQuestionKey = keyMapping[analysisResult.nextQuestionKey] || analysisResult.nextQuestionKey;
          }
          console.log('[CHAT_API_DEBUG] Moving to next question:', {
            from: standardCurrentKey,
            aiSuggested: analysisResult.nextQuestionKey,
            standardizedNext: nextQuestionKey || 'COMPLETE',
            collectedAnswers: Object.keys(collectedAnswers),
            chatId
          });
        } else {
          console.log('[CHAT_API_DEBUG] Staying on current question due to invalid answer:', {
            questionKey: standardCurrentKey,
            chatId
          });
        }
        
        // If we're complete, generate a summary with all collected information
        if (isComplete) {
          console.log('[CHAT_API_DEBUG] Hybrid offer information collection complete, generating summary');
          
          // Build a completion prompt with the collected information
          const summaryPrompt = [
            {
              role: "system",
              content: `Create a hybrid offer based on the collected information.
A hybrid offer combines digital and physical components at different price points.
Be direct and concise. Avoid fluff. Focus on specific ideas for the hybrid offer.`
            },
            {
              role: "user",
              content: `Create a hybrid offer using this information:
      
Core: ${collectedAnswers.offerDescription || "Not provided"}
Audience: ${collectedAnswers.targetAudience || "Not provided"}
Pain points: ${collectedAnswers.painPoints || "Not provided"}
Solution: ${collectedAnswers.solution || "Not provided"}
Pricing: ${collectedAnswers.pricing || "Not provided"}
Results: ${collectedAnswers.clientResult || "Not provided"}

Suggest specific ideas for digital and physical components.`
            }
          ];
          
          // Call OpenAI to generate a tailored summary
          const summaryCompletion = await openai.chat.completions.create({
            model: OPENAI_MODEL,
            messages: summaryPrompt,
            temperature: 0.7,
            max_tokens: 1000,
          });
          
          // Extract the summary content
          aiResponse = summaryCompletion.choices[0].message.content;
          console.log('[CHAT_API_DEBUG] Generated hybrid offer summary:', {
            responseLength: aiResponse.length,
            chatId
          });
        }
        
        // Build the response payload
        responsePayload = {
          message: aiResponse,
          currentQuestionKey: nextQuestionKey,
          collectedAnswers: { ...collectedAnswers },
          isComplete,
          chatId: chatId
        };
        
        console.log('[CHAT_API_DEBUG] Sending hybrid offer response:', {
          nextQuestion: nextQuestionKey,
          answersCount: Object.keys(collectedAnswers).length,
          answersKeys: Object.keys(collectedAnswers),
          chatId,
          isComplete,
          messageLength: aiResponse.length
        });
        return NextResponse.json(responsePayload);
        
      } catch (error) {
        console.error('[CHAT_API_DEBUG] Error parsing analysis result:', {
          error: error.message,
          stack: error.stack,
          chatId
        });
        // Fall back to standard processing
        aiResponse = "I'm having trouble processing that response. Could you please provide more details about " + 
          hybridOfferQuestions.find(q => q.key === currentQuestionKey)?.question || "your offering";
        
        responsePayload = {
          message: aiResponse,
          currentQuestionKey,
          collectedAnswers: { ...collectedAnswers },
          isComplete: false,
          chatId: chatId
        };
        
        console.log('[CHAT_API_DEBUG] Sending error fallback response:', {
          currentQuestion: currentQuestionKey,
          answersCount: Object.keys(collectedAnswers).length,
          answersKeys: Object.keys(collectedAnswers),
          chatId
        });
        return NextResponse.json(responsePayload);
      }
    }

    // Add GPT assistant handling for regular chat
    if (!tool) {
      console.log('[CHAT_API_DEBUG] Using GPT Assistant for regular chat');
      
      try {
        // Create a new assistant thread for each conversation
        // This simplified approach doesn't require thread ID storage in database
        console.log(`[CHAT_API_DEBUG] Creating new assistant thread for chat: ${chatId}`);
        const thread = await openai.beta.threads.create();
        const assistantThreadId = thread.id;
        console.log(`[CHAT_API_DEBUG] Created new assistant thread ID: ${assistantThreadId}`);
        
        // Get the latest user message
        const latestUserMessage = messages[messages.length - 1].content;
        
        // Get the last 5 messages from Supabase for context
        const { data: recentMessages, error: messagesError } = await supabase
          .from('messages')
          .select('role, content')
          .eq('thread_id', chatId)
          .order('timestamp', { ascending: false })
          .limit(6); // Get 6 to exclude the current message which would be the most recent
        
        if (messagesError) {
          console.error('[CHAT_API_DEBUG] Error fetching recent messages:', messagesError);
        }
        
        // Add context to the user's new message if we have previous messages
        let enhancedMessage = latestUserMessage;
        
        if (recentMessages && recentMessages.length > 1) {
          // Remove the most recent message (which is the one we're processing now)
          const contextMessages = recentMessages.slice(1, 6).reverse();
          
          console.log(`[CHAT_API_DEBUG] Adding ${contextMessages.length} messages as context`);
          
          // Format previous messages as context for the new message
          let contextString = "Here's the recent conversation history for context:\n\n";
          
          contextMessages.forEach(msg => {
            const role = msg.role === 'user' ? 'User' : 'Assistant';
            contextString += `${role}: ${msg.content}\n`;
          });
          
          contextString += "\nPlease keep this context in mind when responding to the following message:\n";
          enhancedMessage = contextString + enhancedMessage;
        }
        
        // Add the message to the assistant thread
        await openai.beta.threads.messages.create(
          assistantThreadId,
          {
            role: "user",
            content: enhancedMessage
          }
        );
        
        // Run the assistant
        const run = await openai.beta.threads.runs.create(
          assistantThreadId,
          {
            assistant_id: GPT_ASSISTANT_ID
          }
        );
        
        // Poll for completion
        let runStatus = await openai.beta.threads.runs.retrieve(
          assistantThreadId,
          run.id
        );
        
        // Simple polling with timeout (30 seconds max)
        const startTime = Date.now();
        const maxWaitTime = 30000; // 30 seconds
        
        while (
          runStatus.status !== "completed" && 
          runStatus.status !== "failed" &&
          runStatus.status !== "cancelled" &&
          Date.now() - startTime < maxWaitTime
        ) {
          // Wait 1 second before checking again
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          runStatus = await openai.beta.threads.runs.retrieve(
            assistantThreadId,
            run.id
          );
          
          console.log(`[CHAT_API_DEBUG] Run status: ${runStatus.status}`);
        }
        
        if (runStatus.status === "completed") {
          // Get the assistant's response
          const messagesResponse = await openai.beta.threads.messages.list(
            assistantThreadId
          );
          
          // The first message is the most recent one from the assistant
          const assistantMessages = messagesResponse.data.filter(msg => msg.role === "assistant");
          
          if (assistantMessages.length > 0) {
            // Get the latest message
            const latestMessage = assistantMessages[0];
            
            // Extract text content
            let messageContent = "";
            if (latestMessage.content && latestMessage.content.length > 0) {
              for (const contentPart of latestMessage.content) {
                if (contentPart.type === 'text') {
                  messageContent += contentPart.text.value;
                }
              }
            }
            
            return NextResponse.json({
              message: messageContent,
              chatId: chatId
            });
          } else {
            throw new Error("No assistant message found in response");
          }
        } else {
          throw new Error(`Assistant run did not complete: ${runStatus.status}`);
        }
      } catch (error) {
        console.error('[CHAT_API_DEBUG] GPT Assistant error:', error);
        return NextResponse.json(
          { error: `Error with GPT Assistant: ${error.message}`, chatId },
          { status: 500 }
        );
      }
    }

    // Build the final response payload if not already set by a tool handler
    if (!responsePayload) {
      responsePayload = {
        message: aiResponse,
        currentQuestionKey,
        collectedAnswers: { ...collectedAnswers }, // Make sure we're passing a copy of the latest collectedAnswers
        isComplete,
        chatId: chatId // Always include the chatId in the response
      };
      
      console.log('[CHAT_API_DEBUG] Sending fallback response:', {
        answersCount: Object.keys(collectedAnswers).length,
        answersKeys: Object.keys(collectedAnswers),
        chatId: chatId, // Log the chatId being returned
        messageLength: aiResponse.length
      });
    }

    console.log('[CHAT_API_DEBUG] Sending response with chat ID:', chatId);
    return NextResponse.json(responsePayload);

  } catch (error) {
    console.error('[CHAT_API_DEBUG] Error in API route:', {
      error: error.message,
      stack: error.stack
    });
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}

// Helper function to check if a string is a valid UUID
function isValidUUID(id) {
  if (!id) return false;
  
  // UUID v4 pattern
  const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidV4Pattern.test(id);
} 