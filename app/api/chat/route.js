import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { storeTaskData } from '@/lib/tempStore'; // Import the store function

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

// Define the questions and their corresponding keys, in order
const hybridOfferQuestions = [
  { key: 'offerDescription', question: "Okay, let's start! Tell us about the offer high level." }, // Make first question conversational
  { key: 'targetAudience', question: "Who is your target audience?" },
  { key: 'painPoints', question: "What are their main pain points?" },
  { key: 'solution', question: "What is the unique way you solve this problem?" },
  { key: 'pricing', question: "What is your pricing structure?" },
  { key: 'clientResult', question: "Finally, what's your biggest client result?" } // Make last question conversational
];

export async function POST(req) {
  const requestStartTime = Date.now(); // For timing logs
  console.log(`\n--- [API /api/chat POST Request Start ${requestStartTime}] ---`);

  try {
    // Include chatId in the expected request body from frontend
    const { messages, currentTool, collectedAnswers: receivedAnswers, currentQuestionKey, chatId } = await req.json();
    console.log(`[${requestStartTime}] Received Data:`, { currentTool, chatId, currentQuestionKey });
    console.log(`[${requestStartTime}] Received collectedAnswers:`, JSON.stringify(receivedAnswers || {}, null, 2)); // Log received answers

    if (!chatId) {
       console.error("Error: chatId is missing from the request body.");
       return NextResponse.json({ error: 'Internal server error', details: 'Missing required chatId' }, { status: 500 });
    }

    if (currentTool !== 'hybrid-offer') {
        // Handle generic chat (remains unchanged)
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: "You are a helpful AI assistant." }, ...messages],
            temperature: 0.7, max_tokens: 500,
        });
        return NextResponse.json({ message: completion.choices[0].message });
    }

    // --- Hybrid Offer Logic ---

    const latestUserMessage = messages[messages.length - 1]?.content;
    let updatedAnswers = { ...(receivedAnswers || {}) }; // Ensure we start with received answers
    let nextQuestionKey = currentQuestionKey; // Will be null on first call
    let finalAssistantMessageContent = "";
    let isComplete = false; // Flag to signal frontend
    let isInitialCall = messages.length <= 1; // Adjust check: 0 or 1 message (initial AI message) means initial user response

    console.log(`[${requestStartTime}] Initial updatedAnswers state:`, JSON.stringify(updatedAnswers, null, 2));

    // --- Answer Extraction (Only if not initial call and user provided input) ---
    if (!isInitialCall && currentQuestionKey && latestUserMessage) {
      const questionAskedText = hybridOfferQuestions.find(q => q.key === currentQuestionKey)?.question || `related to ${currentQuestionKey}`;
      console.log(`[${requestStartTime}] Attempting extraction for key: ${currentQuestionKey} (Question: "${questionAskedText}")`);
      const extractionPrompt = [
          { role: "system", content: `You are an information extraction assistant. The user was likely asked about: "${questionAskedText}". Their response was: "${latestUserMessage}". Extract the core answer related to the likely topic. Respond ONLY with the extracted answer, no explanations. If the response seems unrelated, respond with "UNRELATED".`},
          { role: "user", content: latestUserMessage }
      ];
      try {
          const extractionStart = Date.now();
          const extractionCompletion = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: extractionPrompt, temperature: 0.1, max_tokens: 150,
          });
          const extractedAnswer = extractionCompletion.choices[0].message.content.trim();
          console.log(`[${requestStartTime}] Extraction LLM call took ${Date.now() - extractionStart}ms. Result: "${extractedAnswer}"`);

          if (extractedAnswer && extractedAnswer !== "UNRELATED" && extractedAnswer.length > 1) {
              updatedAnswers[currentQuestionKey] = extractedAnswer;
              console.log(`[${requestStartTime}] Successfully updated answers for key '${currentQuestionKey}'. New updatedAnswers:`, JSON.stringify(updatedAnswers, null, 2));
          } else {
              console.log(`[${requestStartTime}] No relevant answer extracted or 'UNRELATED' received for key '${currentQuestionKey}'. 'updatedAnswers' remains unchanged for this key.`);
          }
      } catch (extractionError) {
          console.error(`[${requestStartTime}] Error during answer extraction for key '${currentQuestionKey}':`, extractionError);
      }
    } else {
         console.log(`[${requestStartTime}] Skipping extraction. Initial call: ${isInitialCall}, Key: ${currentQuestionKey}, Message: ${latestUserMessage ? 'Exists' : 'Missing'}`);
    }

    // --- Determine Next Step ---
    // *** Log the state BEFORE finding the next question ***
    console.log(`[${requestStartTime}] Determining next step based on updatedAnswers:`, JSON.stringify(updatedAnswers, null, 2));
    const firstUnanswered = hybridOfferQuestions.find(q => !updatedAnswers[q.key]);
    console.log(`[${requestStartTime}] Result of find firstUnanswered:`, firstUnanswered ? `Key: ${firstUnanswered.key}` : 'None (all answered)');

    if (firstUnanswered) {
        // --- Ask Next Question (or First Question) ---
        nextQuestionKey = firstUnanswered.key;
        const nextQuestionText = firstUnanswered.question;
        console.log(`[${requestStartTime}] Next question determined: [${nextQuestionKey}] ${nextQuestionText}`);

        // Adjust the system prompt slightly for the very first message
        const systemContent = isInitialCall
          ? `You are a friendly AI coach starting a session to help a user create a hybrid offer. Start with a brief, welcoming sentence (1 sentence max) and then ask the first question: "${nextQuestionText}". Keep the total response concise (2-3 sentences).`
          : `You are a friendly and concise AI coach helping a user create a hybrid offer. The user just responded to the previous topic. Now, ask the user the *next* question in the sequence: "${nextQuestionText}". Keep your response very brief (1-2 sentences), be natural, and DO NOT ask follow-up questions about the *previous* topic. Just ask the next question.`;

        const conversationalPrompt = [
             { role: "system", content: systemContent },
             // Provide context only if it's not the initial call
             ...(isInitialCall ? [] : messages.slice(-4))
         ];

        try {
            const convCompletion = await openai.chat.completions.create({ model: "gpt-4o-mini", messages: conversationalPrompt, temperature: 0.6, max_tokens: 100, });
            finalAssistantMessageContent = convCompletion.choices[0].message.content.trim();
        } catch (convError) {
             console.error("Error generating conversational question:", convError);
             finalAssistantMessageContent = nextQuestionText; // Fallback
         }

    } else {
        // --- All Questions Answered - Store data for SSE ---
        isComplete = true; // Set completion flag
        nextQuestionKey = null;
        console.log(`[${requestStartTime}] All questions answered. Storing final data for task ${chatId}:`, updatedAnswers);
        finalAssistantMessageContent = "Great! I have all the information needed. Generating your hybrid offer document now... This might take a minute."; // Update message

        // Store the final answers using the chatId
        storeTaskData(chatId, updatedAnswers);
        
        // DO NOT call n8n here anymore
        console.log(`[${requestStartTime}] Data stored for ${chatId}. Frontend should now connect to SSE endpoint.`);
    }

    // --- Return Response to Frontend ---
    const responsePayload = {
        message: { role: "assistant", content: finalAssistantMessageContent },
        collectedAnswers: updatedAnswers,
        currentQuestionKey: nextQuestionKey,
        isComplete: isComplete, // Send completion status
        chatId: chatId // Echo back chatId for confirmation (optional)
    };
    console.log(`[${requestStartTime}] Returning response payload:`, JSON.stringify(responsePayload, null, 2));
    console.log(`--- [API /api/chat POST Request End ${requestStartTime} - Took ${Date.now() - requestStartTime}ms] ---`);
    return NextResponse.json(responsePayload);

  } catch (error) {
    console.error(`[${requestStartTime}] CRITICAL Error in chat route:`, error);
    if (error instanceof OpenAI.APIError) {
        console.error('OpenAI API Error:', error.status, error.name, error.headers, error.message);
    }
    return NextResponse.json(
      { error: 'Internal server error', details: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
} 