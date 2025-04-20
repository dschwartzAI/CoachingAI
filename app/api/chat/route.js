import { OpenAI } from 'openai';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { TOOLS } from '@/lib/config/tools';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

// Define the questions and their corresponding keys, in order
const hybridOfferQuestions = [
  { key: 'offerDescription', question: "Welcome! I'm excited to help you craft a fantastic hybrid offer. Could you tell me a bit about your core offering, whether it's a product or a service?" }, // Make first question conversational
  { key: 'targetAudience', question: "Who is your target audience?" },
  { key: 'painPoints', question: "What are their main pain points?" },
  { key: 'solution', question: "What is the unique way you solve this problem?" },
  { key: 'pricing', question: "What is your pricing structure?" },
  { key: 'clientResult', question: "Finally, what's your biggest client result?" } // Make last question conversational
];

export async function POST(request) {
  try {
    // Get the request body
    const body = await request.json();
    const { messages, tool, isToolInit } = body;

    console.log('[Chat API] Request received:', { 
      messageCount: messages?.length || 0, 
      toolId: tool || 'none',
      isToolInit: isToolInit || false 
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
    
    // Only verify authentication if not explicitly skipped
    if (process.env.NEXT_PUBLIC_SKIP_AUTH !== 'true') {
      console.log('[Chat API] Verifying authentication...');
      const cookieStore = cookies();
      const supabase = createServerClient(
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

      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) {
        console.log('[Chat API] Authentication failed');
        isAuthenticated = false;
      } else {
        console.log('[Chat API] Authentication successful');
      }
    } else {
      console.log('[Chat API] Authentication check SKIPPED (NEXT_PUBLIC_SKIP_AUTH=true)');
    }
    
    // Check if we have an authenticated session (unless skipped)
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Chat API] Calling OpenAI with', messages.length, 'messages');
    
    // Log message details (careful with sensitive data)
    messages.forEach((msg, i) => {
      console.log(`[Chat API] Message ${i+1}: role=${msg.role}, content_length=${msg.content?.length || 0}`);
    });
    
    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
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
    
    // For hybrid offer tool, try to determine the current question key
    let currentQuestionKey = null;
    let isComplete = false;
    const collectedAnswers = body.collectedAnswers || {};
    
    if (tool === 'hybrid-offer') {
      console.log('[Chat API] Processing hybrid-offer tool logic');
      console.log('[Chat API] Current question key from request:', body.currentQuestionKey);
      console.log('[Chat API] Collected answers:', collectedAnswers);
      
      // Determine if all questions have been answered
      const allQuestionsAnswered = hybridOfferQuestions.every(q => 
        collectedAnswers[q.key] !== undefined && collectedAnswers[q.key] !== '');
        
      if (allQuestionsAnswered) {
        console.log('[Chat API] All questions answered, marking as complete');
        isComplete = true;
        currentQuestionKey = null; // No more questions
      } else {
        // Either use the provided key or find the next unanswered question
        currentQuestionKey = body.currentQuestionKey;
        
        // Store the answer to the current question if we have one
        if (currentQuestionKey && messages.length > 0) {
          const lastUserMessage = messages.find(m => m.role === 'user');
          if (lastUserMessage) {
            // Save this answer to the current question
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
            !collectedAnswers[q.key] || collectedAnswers[q.key] === '');
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
        // If we're complete, send a completion message
        content = "Thank you for providing all the information! I'll now generate your hybrid offer documents. This might take a moment...";
      }
    }
    
    const responsePayload = {
      message: content,
      currentQuestionKey,
      collectedAnswers,
      isComplete,
      chatId: body.chatId
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