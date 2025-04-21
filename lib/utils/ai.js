import { getNextQuestion, getProgress, isComplete, generateN8NPayload, TOOLS } from '@/lib/config/tools';

export async function getAIResponse(userInput, thread) {
  console.log('[AI Service] getAIResponse called with:', { 
    userInput: userInput ? `${userInput.substring(0, 20)}...` : '(empty)', 
    receivedThreadId: thread?.id,
    toolId: thread?.tool_id,
    messagesCount: thread?.messages?.length || 0
  });

  const tool = thread?.tool_id ? TOOLS[thread.tool_id] : null;
  const isToolInit = tool?.initiatesConversation && (!thread.messages || thread.messages.length === 0);
  const allMessages = thread.messages || []; // Ensure messages is always an array

  console.log('[AI Service] Processing parameters:', {
    isToolInit,
    toolId: tool?.id || 'none',
    messagesCount: allMessages.length
  });

  try {
    let messagesToSend = [];
    let systemMessageContent = "You are a helpful AI assistant.";

    // --- Tool Specific Logic ---
    if (tool) {
      systemMessageContent = tool.systemMessage || systemMessageContent;
      console.log(`[AI Service] Using tool: ${tool.id}. System Message: "${systemMessageContent.substring(0, 50)}..."`);

      const { nextQuestion, allQuestionsAnswered, answers } = getNextQuestion(tool, allMessages);
      console.log('[AI Service] Tool state:', { 
        nextQuestion: nextQuestion?.key || 'none', 
        allQuestionsAnswered: !!allQuestionsAnswered,
        answersCount: Object.keys(answers || {}).length
      });

      if (isToolInit) {
        console.log('[AI Service] Tool Initialization Flow');
        
        // Two options - either return directly or call the API
        if (process.env.NEXT_PUBLIC_USE_DIRECT_QUESTIONS === 'true') {
          // Direct return path - no API call
          console.log(`[AI Service] Using direct question return: "${nextQuestion?.question}"`);
          return { content: nextQuestion?.question || "Welcome! Let's get started." };
        }
        
        // If we get here, we'll use the API with isToolInit flag
        messagesToSend.push({ role: 'system', content: systemMessageContent });
        console.log('[AI Service] Using API for tool initialization with isToolInit=true');
      } else if (allQuestionsAnswered) {
        console.log('[AI Service] All questions answered. Preparing for n8n.');
        const completionMessage = "Thanks for providing all the information! I'm now generating the required documents for you. This might take a moment...";
        // Don't call the API, just return the completion message. The client will trigger SSE.
        return { content: completionMessage };
      } else if (nextQuestion) {
        // Append the next question hint to the system message if appropriate
        systemMessageContent += `
Guidance: Ask the user the following question next, based on their previous answers: "${nextQuestion.question}"`;
        console.log('[AI Service] Next question determined:', nextQuestion.question);
      }

      // Prepare messages for API call (excluding direct return cases)
      messagesToSend.push({ role: 'system', content: systemMessageContent });
      
      // Log user messages being sent
      console.log('[AI Service] User messages to include:', allMessages.map(msg => ({
        role: msg.role,
        contentLength: msg.content?.length || 0
      })));
      
      messagesToSend.push(...allMessages); // Add existing messages
      
      if (userInput) {
        console.log('[AI Service] Adding current user input:', userInput.substring(0, 30) + '...');
        messagesToSend.push({ role: 'user', content: userInput }); // Add current user input
      }
    } else {
      // --- Standard Chat Logic ---
      console.log('[AI Service] Standard Chat Flow');
      messagesToSend.push({ role: 'system', content: systemMessageContent });
      messagesToSend.push(...allMessages);
      if (userInput) {
        messagesToSend.push({ role: 'user', content: userInput });
      }
    }

    // Ensure we don't send an empty message array if it's not tool init
    if (!isToolInit && messagesToSend.length <= 1 && !userInput) {
       console.error('[AI Service] Attempted to call API with only system message in non-init flow.');
       return { error: 'Cannot process empty input.' };
    }

    console.log(`[AI Service] Calling OpenAI API with ${messagesToSend.length} messages. isToolInit=${isToolInit}`);
    
    // Full logging of messages - careful with long content
    messagesToSend.forEach((msg, i) => {
      console.log(`[AI Service] Message ${i+1}: ${msg.role}, length: ${msg.content?.length || 0} chars`);
    });
    
    const requestBody = {
      messages: messagesToSend,
      tool: tool?.id,
      isToolInit: isToolInit,
      // ENSURE chatId is always included when we have a thread.id
      chatId: thread?.id,
      // Add any current state that might be needed by the API
      collectedAnswers: tool ? getProgress(tool, allMessages).answers : undefined,
      currentQuestionKey: nextQuestion?.key
    };
    
    // Log the ID right before sending
    console.log('[AI Service] Request body being sent:', {
      chatIdToSend: requestBody.chatId, 
      messageCount: messagesToSend.length,
      isToolInit
    });
    
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    console.log(`[AI Service] Response status: ${response.status}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response from API' }));
      console.error(`[AI Service] API call failed with status ${response.status}:`, errorData);
      return { error: errorData.error || `API request failed with status ${response.status}` };
    }

    const data = await response.json();
    console.log('[AI Service] Received successful API response:', JSON.stringify(data));
    return { content: data.message };

  } catch (error) {
    console.error('[AI Service] Error in getAIResponse:', error);
    return { error: error.message || 'An unexpected error occurred.' };
  }
} 