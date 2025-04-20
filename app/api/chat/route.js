import { OpenAI } from 'openai';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { TOOLS } from '@/lib/config/tools';
import { v4 as uuidv4 } from 'uuid';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

// Define the questions and their corresponding keys, in order
const hybridOfferQuestions = [
  { 
    key: 'offerDescription', 
    question: "Welcome! I'm excited to help you craft a fantastic hybrid offer. Could you tell me a bit about your core offering, whether it's a product or a service?",
    guidanceMessage: "I'd love to hear more details about your core offering. What specific product or service are you providing? This helps me craft a better hybrid offer for you."
  },
  { 
    key: 'targetAudience', 
    question: "Who is your target audience?",
    guidanceMessage: "Understanding your audience is crucial. Could you share more about who would benefit most from your offering? Consider demographics, pain points, or specific needs they have."
  },
  { 
    key: 'painPoints', 
    question: "What are their main pain points?",
    guidanceMessage: "Knowing the problems your audience faces helps create a compelling offer. Could you elaborate on the specific challenges they encounter that your product/service helps solve?"
  },
  { 
    key: 'solution', 
    question: "What is the unique way you solve this problem?",
    guidanceMessage: "Your unique approach is what sets you apart! Could you share more about how your solution works and what makes it different from alternatives?"
  },
  { 
    key: 'pricing', 
    question: "What is your pricing structure?",
    guidanceMessage: "Pricing is a key element of your offer. Could you provide more details about your pricing model or the price range you're considering?"
  },
  { 
    key: 'clientResult', 
    question: "Finally, what's your biggest client result?",
    guidanceMessage: "Success stories really make your offer shine! Could you share a specific result or transformation that clients have experienced with your product/service?"
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
      model: "gpt-4o-mini",
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
    
    // Generate a proper UUID if client did not provide one or provided a non-UUID format
    let chatId = clientChatId;
    if (!chatId || !isValidUUID(chatId)) {
      chatId = uuidv4();
      console.log(`[Chat API] Generated proper UUID for non-UUID chatId: ${clientChatId} -> ${chatId}`);
    } else {
      console.log(`[Chat API] Using valid UUID chatId: ${chatId}`);
    }

    console.log('[Chat API] Request received:', { 
      messageCount: messages?.length || 0, 
      toolId: tool || 'none',
      isToolInit: isToolInit || false,
      originalChatId: clientChatId || 'none',
      newChatId: chatId
    });

    // Verify messages array is not empty - BUT allow empty arrays for tool initialization
    if (!isToolInit && (!messages || !Array.isArray(messages) || messages.length === 0)) {
      console.log('[Chat API] Rejected: Empty messages array in non-init call');
      return NextResponse.json(
        { error: 'Messages array cannot be empty for non-initialization calls' },
        { status: 400 }
      );
    }

    // For tool initialization, we can simply return the first question directly
    if (isToolInit && tool === 'hybrid-offer') {
      console.log('[Chat API] Tool initialization request - returning first question');
      return NextResponse.json({
        message: hybridOfferQuestions[0].question,
        currentQuestionKey: hybridOfferQuestions[0].key,
        collectedAnswers: {}
      });
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
      console.log('[Chat API] Verifying authentication...');

      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) {
        console.log('[Chat API] Authentication failed');
        isAuthenticated = false;
      } else {
        console.log('[Chat API] Authentication successful');
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
      console.log('[Chat API] Authentication check SKIPPED (NEXT_PUBLIC_SKIP_AUTH=true)');
      // Use a fixed development user ID for development mode
      userId = 'dev-user-' + (chatId || uuidv4().substring(0, 8));
      console.log('[Chat API] Using development user ID:', userId);
    }

    // Save thread and messages to Supabase if needed
    if (chatId && messages.length > 0) {
      try {
        console.log('[Chat API] Checking if thread exists...');
        let { data: existingThread, error: lookupError } = await supabase
          .from('threads')
          .select('id')
          .eq('id', chatId)
          .single();
        
        // If there was an error or no thread found
        if (lookupError || !existingThread) {
          console.log('[Chat API] Thread not found, creating new thread in Supabase');
          
          // Find the first user message to use for the title
          const firstUserMessage = messages.find(msg => msg.role === 'user');
          const threadTitle = firstUserMessage 
            ? generateThreadTitle(firstUserMessage)
            : (tool ? TOOLS[tool]?.name || 'Tool Chat' : 'New conversation');
          
          console.log('[Chat API] Creating thread with title:', {
            title: threadTitle,
            fromUserMessage: !!firstUserMessage,
            toolName: tool ? TOOLS[tool]?.name : null
          });
          
          // Create the thread with proper UUID
          const { data: newThread, error: threadError } = await supabase
            .from('threads')
            .insert({
              id: chatId,  // Now using valid UUID
              title: threadTitle,
              user_id: userId,
              tool_id: tool || null,
            })
            .select()
            .single();
            
          if (threadError) {
            console.error('[Chat API] Error creating thread:', threadError);
          } else {
            console.log('[Chat API] Thread created successfully:', newThread.id);
            existingThread = newThread;
          }
        } else {
          console.log('[Chat API] Thread exists:', existingThread.id);
        }

        // Check if the last message exists in the database
        if (messages.length > 0) {
          const lastMessage = messages[messages.length - 1];
          if (lastMessage && lastMessage.content) {
            console.log('[Chat API] Saving last message to Supabase');
            
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
              console.error('[Chat API] Error saving message:', messageError);
            } else {
              console.log('[Chat API] Message saved successfully:', savedMessage.id);
            }
          }
        }
      } catch (dbError) {
        console.error('[Chat API] Database error:', dbError);
        // Continue with the API call even if database operations fail
      }
    }

    console.log('[Chat API] Calling OpenAI with', messages.length, 'messages');
    
    // Log message details (careful with sensitive data)
    messages.forEach((msg, i) => {
      console.log(`[Chat API] Message ${i+1}: role=${msg.role}, content_length=${msg.content?.length || 0}`);
    });
    
    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    console.log('[Chat API] OpenAI response received');
    
    // Extract content, handling both string and object formats
    let content = completion.choices[0].message.content;
    // For safety, ensure content is a string
    if (typeof content !== 'string') {
      console.log('[Chat API] Content is not a string, converting:', content);
      content = JSON.stringify(content);
    }
    
    // Save the assistant's response to the database if we have a chatId
    if (chatId && supabase) {
      try {
        console.log('[Chat API] Saving assistant response to Supabase');
        
        const messageObj = {
          thread_id: chatId,  // Using valid UUID
          role: 'assistant',
          content: content,
          timestamp: new Date().toISOString()
        };
        
        const { data: savedMessage, error: messageError } = await supabase
          .from('messages')
          .insert(messageObj)
          .select()
          .single();
          
        if (messageError) {
          console.error('[Chat API] Error saving assistant message:', messageError);
        } else {
          console.log('[Chat API] Assistant message saved successfully:', savedMessage.id);
        }
      } catch (dbError) {
        console.error('[Chat API] Database error saving assistant message:', dbError);
        // Continue with the response even if database operations fail
      }
    }
    
    // For hybrid offer tool, try to determine the current question key
    let currentQuestionKey = null;
    let isComplete = false;
    const collectedAnswers = body.collectedAnswers || {};
    
    if (tool === 'hybrid-offer') {
      console.log('[Chat API] Processing hybrid-offer tool logic');
      console.log('[Chat API] Current question key from request:', body.currentQuestionKey);
      console.log('[Chat API] Collected answers:', collectedAnswers);
      
      // Determine if all questions have been answered with valid responses
      const allQuestionsAnswered = hybridOfferQuestions.every(q => 
        collectedAnswers[q.key] !== undefined && 
        collectedAnswers[q.key] !== ''
      );
        
      if (allQuestionsAnswered) {
        console.log('[Chat API] All questions answered with valid responses, marking as complete');
        isComplete = true;
        currentQuestionKey = null; // No more questions
      } else {
        // Either use the provided key or find the next unanswered question
        currentQuestionKey = body.currentQuestionKey;
        
        // Store the answer to the current question if we have one
        if (currentQuestionKey && messages.length > 0) {
          const lastUserMessage = messages.find(m => m.role === 'user');
          if (lastUserMessage) {
            // Get the question object
            const currentQuestion = hybridOfferQuestions.find(q => q.key === currentQuestionKey);
            
            // Validate the answer using AI
            if (currentQuestion) {
              console.log(`[Chat API] Validating answer for ${currentQuestionKey}`);
              const validationResult = await validateHybridOfferAnswer(
                currentQuestionKey, 
                lastUserMessage.content
              );
              
              // If the answer isn't valid, provide guidance
              if (!validationResult.isValid) {
                console.log(`[Chat API] Invalid answer for ${currentQuestionKey}, providing guidance`);
                
                // Create a personalized guidance message that incorporates the validation reason
                const personalizedGuidance = `${validationResult.reason} ${currentQuestion.guidanceMessage}`;
                content = personalizedGuidance;
                
                // Don't save this answer or advance to the next question
                responsePayload = {
                  message: content,
                  currentQuestionKey, // Keep the same question
                  collectedAnswers,
                  isComplete: false,
                  chatId: chatId
                };
                
                console.log('[Chat API] Sending guidance response:', JSON.stringify(responsePayload, null, 2));
                return NextResponse.json(responsePayload);
              }
            }
            
            // Save this answer to the current question (if valid)
            collectedAnswers[currentQuestionKey] = lastUserMessage.content;
            console.log(`[Chat API] Saved answer for ${currentQuestionKey}:`, lastUserMessage.content);
          }
        }
        
        // If we have a currentQuestionKey, this response might have answered that question
        // So we should move to the next question in the sequence
        if (currentQuestionKey) {
          console.log('[Chat API] Current question answered:', currentQuestionKey);
          
          // Find the current question's index
          const currentIndex = hybridOfferQuestions.findIndex(q => q.key === currentQuestionKey);
          if (currentIndex >= 0 && currentIndex < hybridOfferQuestions.length - 1) {
            // Move to the next question
            currentQuestionKey = hybridOfferQuestions[currentIndex + 1].key;
            console.log('[Chat API] Moving to next question:', currentQuestionKey);
          } else {
            // We've reached the end of the questions
            console.log('[Chat API] Reached end of questions');
            currentQuestionKey = null;
            isComplete = true;
          }
        }
        
        // If we don't have a question key, find the first unanswered question
        if (!currentQuestionKey && !isComplete) {
          console.log('[Chat API] Finding first unanswered question');
          const unansweredQuestion = hybridOfferQuestions.find(q => 
            !collectedAnswers[q.key] || 
            collectedAnswers[q.key] === ''
          );
          currentQuestionKey = unansweredQuestion?.key || null;
          console.log('[Chat API] First unanswered question:', currentQuestionKey);
          
          if (!currentQuestionKey) {
            isComplete = true;
          }
        }
      }
      
      // For hybrid offer, don't use OpenAI's response - just respond with the next question directly
      if (!isComplete && currentQuestionKey) {
        const questionObj = hybridOfferQuestions.find(q => q.key === currentQuestionKey);
        if (questionObj) {
          console.log(`[Chat API] Sending next hybrid offer question: ${questionObj.question}`);
          
          // Use the question text directly instead of OpenAI's response
          content = questionObj.question;
        }
      } else if (isComplete) {
        // If we're complete, use OpenAI to generate a summary and confirmation
        console.log('[Chat API] Hybrid offer information collection complete, generating summary');
        
        // Build a completion prompt with the collected information
        const summaryPrompt = [
          {
            role: "system",
            content: `You are a helpful assistant creating a hybrid offer based on the following information.
A hybrid offer combines digital and physical components to provide more value and multiple price points.
Review the collected information and provide a friendly, encouraging summary confirming what you've learned.
Be conversational and enthusiastic, and suggest 1-2 specific ideas for the hybrid offer components based on the information.`
          },
          {
            role: "user",
            content: `Here's the information I've provided about my business for creating a hybrid offer:
            
Core Offering: ${collectedAnswers.offerDescription}
Target Audience: ${collectedAnswers.targetAudience}
Pain Points: ${collectedAnswers.painPoints}
My Solution: ${collectedAnswers.solution}
Pricing: ${collectedAnswers.pricing}
Best Client Result: ${collectedAnswers.clientResult}

Please summarize what you've learned and suggest 1-2 specific ideas for my hybrid offer.`
          }
        ];
        
        // Call OpenAI to generate a tailored summary
        const summaryCompletion = await openai.chat.completions.create({
          model: "gpt-4-turbo-preview",
          messages: summaryPrompt,
          temperature: 0.7,
          max_tokens: 1000,
        });
        
        // Extract the summary content
        content = summaryCompletion.choices[0].message.content;
        console.log('[Chat API] Generated hybrid offer summary');
      }
    }
    
    const responsePayload = {
      message: content,
      currentQuestionKey,
      collectedAnswers,
      isComplete,
      chatId: chatId  // Return the valid UUID to the client
    };
    
    console.log('[Chat API] Sending response:', JSON.stringify(responsePayload, null, 2));
    return NextResponse.json(responsePayload);

  } catch (error) {
    console.error('[Chat API] Error:', error);
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