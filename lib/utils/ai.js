import { getNextQuestion, getProgress, isComplete, generateN8NPayload, TOOLS } from '@/lib/config/tools';

export async function getAIResponse(userInput, thread) {
  if (process.env.NODE_ENV !== "production") console.log('[AI Service] getAIResponse called with:', { 
    userInput: userInput ? `${userInput.substring(0, 20)}...` : '(empty)', 
    receivedThreadId: thread?.id,
    toolId: thread?.tool_id,
    messagesCount: thread?.messages?.length || 0
  });
  
  if (process.env.NODE_ENV !== "production") console.log('[AI Service] ⚠️ DEBUGGING LOADING STATES - AI REQUEST STARTING ⚠️');

  const tool = thread?.tool_id ? TOOLS[thread.tool_id] : null;
  const isToolInit = tool?.initiatesConversation && (!thread.messages || thread.messages.length === 0);
  const allMessages = thread.messages || []; // Ensure messages is always an array

  if (process.env.NODE_ENV !== "production") console.log('[AI Service] Processing parameters:', {
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
      if (process.env.NODE_ENV !== "production") console.log(`[AI Service] Using tool: ${tool.id}. System Message: "${systemMessageContent.substring(0, 50)}..."`);

      const { nextQuestion, allQuestionsAnswered, answers } = getNextQuestion(tool, allMessages);
      if (process.env.NODE_ENV !== "production") console.log('[AI Service] Tool state:', { 
        nextQuestion: nextQuestion?.key || 'none', 
        allQuestionsAnswered: !!allQuestionsAnswered,
        answersCount: Object.keys(answers || {}).length
      });

      if (isToolInit) {
        if (process.env.NODE_ENV !== "production") console.log('[AI Service] Tool Initialization Flow');
        
        // Two options - either return directly or call the API
        if (process.env.NEXT_PUBLIC_USE_DIRECT_QUESTIONS === 'true') {
          // Direct return path - no API call
          if (process.env.NODE_ENV !== "production") console.log(`[AI Service] Using direct question return: "${nextQuestion?.question}"`);
          return { content: nextQuestion?.question || "Welcome! Let's get started." };
        }
        
        // If we get here, we'll use the API with isToolInit flag
        messagesToSend.push({ role: 'system', content: systemMessageContent });
        if (process.env.NODE_ENV !== "production") console.log('[AI Service] Using API for tool initialization with isToolInit=true');
      } else if (allQuestionsAnswered) {
        if (process.env.NODE_ENV !== "production") console.log('[AI Service] All questions answered. Preparing for n8n.');
        const completionMessage = "Thanks for providing all the information! I'm now generating the required documents for you. This might take a moment...";
        // Don't call the API, just return the completion message. The client will trigger SSE.
        return { content: completionMessage };
      } else if (nextQuestion) {
        // Append the next question hint to the system message if appropriate
        systemMessageContent += `
Guidance: Ask the user the following question next, based on their previous answers: "${nextQuestion.question}"`;
        if (process.env.NODE_ENV !== "production") console.log('[AI Service] Next question determined:', nextQuestion.question);
      }

      // Prepare messages for API call (excluding direct return cases)
      messagesToSend.push({ role: 'system', content: systemMessageContent });
      
      // Log user messages being sent
      if (process.env.NODE_ENV !== "production") console.log('[AI Service] User messages to include:', allMessages.map(msg => ({
        role: msg.role,
        contentLength: msg.content?.length || 0
      })));
      
      messagesToSend.push(...allMessages); // Add existing messages
      
      if (userInput) {
        if (process.env.NODE_ENV !== "production") console.log('[AI Service] Adding current user input:', userInput.substring(0, 30) + '...');
        messagesToSend.push({ role: 'user', content: userInput }); // Add current user input
      }
    } else {
      // --- Standard Chat Logic ---
      if (process.env.NODE_ENV !== "production") console.log('[AI Service] Standard Chat Flow');
      messagesToSend.push({ role: 'system', content: systemMessageContent });
      messagesToSend.push(...allMessages);
      if (userInput) {
        messagesToSend.push({ role: 'user', content: userInput });
      }
    }

    // Ensure we don't send an empty message array if it's not tool init
    if (!isToolInit && messagesToSend.length <= 1 && !userInput) {
       if (process.env.NODE_ENV !== "production") console.error('[AI Service] Attempted to call API with only system message in non-init flow.');
       return { error: 'Cannot process empty input.' };
    }

    if (process.env.NODE_ENV !== "production") console.log(`[AI Service] Calling OpenAI API with ${messagesToSend.length} messages. isToolInit=${isToolInit}`);
    
    // Full logging of messages - careful with long content
    messagesToSend.forEach((msg, i) => {
      if (process.env.NODE_ENV !== "production") console.log(`[AI Service] Message ${i+1}: ${msg.role}, length: ${msg.content?.length || 0} chars`);
    });
    
    const requestBody = {
      messages: messagesToSend,
      tool: tool?.id,
      isToolInit: isToolInit,
      // ENSURE chatId is always included when we have a thread.id
      chatId: thread?.id,
      // Add any current state that might be needed by the API
      collectedAnswers: thread?.collectedAnswers || (tool ? getProgress(tool, allMessages).answers : undefined),
      currentQuestionKey: thread?.currentQuestionKey || nextQuestion?.key,
      questionsAnswered: thread?.questionsAnswered
    };
    
    // Log the ID right before sending
    if (process.env.NODE_ENV !== "production") console.log('[AI Service] Request body being sent:', {
      chatIdToSend: requestBody.chatId, 
      messageCount: messagesToSend.length,
      isToolInit,
      questionsAnswered: requestBody.questionsAnswered,
      currentQuestionKey: requestBody.currentQuestionKey
    });
    
    if (process.env.NODE_ENV !== "production") console.log('[AI Service] ⚠️ SENDING API REQUEST - LOADING SHOULD BE TRUE ⚠️');
    
    // For regular chat (no tool), handle streaming response
    if (!tool) {
      if (process.env.NODE_ENV !== "production") console.log('[AI Service] Regular chat - using streaming response');
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (process.env.NODE_ENV !== "production") console.log(`[AI Service] Response status: ${response.status}`);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Failed to parse error response');
          if (process.env.NODE_ENV !== "production") console.error(`[AI Service] Streaming API call failed with status ${response.status}:`, errorText);
          return { error: errorText || `API request failed with status ${response.status}` };
        }

        // For streaming response, we'll accumulate the content
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedResponse = '';

        // Create streaming reader
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const textChunk = decoder.decode(value, { stream: true });
          accumulatedResponse += textChunk;
          
          // You can implement a callback for real-time updates if needed
          // onStreamUpdate(textChunk);
        }

        if (process.env.NODE_ENV !== "production") console.log('[AI Service] Streaming completed. Final length:', accumulatedResponse.length);
        if (process.env.NODE_ENV !== "production") console.log('[AI Service] ⚠️ STREAMING COMPLETE - LOADING WILL BE SET TO FALSE ⚠️');

        return { 
          content: accumulatedResponse,
          isStreamed: true
        };
      } catch (error) {
        if (process.env.NODE_ENV !== "production") console.error('[AI Service] Error in streaming response:', error);
        return { error: error.message || 'An error occurred during streaming.' };
      }
    }
    
    // For tool-based conversations, continue with the JSON response approach
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (process.env.NODE_ENV !== "production") console.log(`[AI Service] Response status: ${response.status}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response from API' }));
      if (process.env.NODE_ENV !== "production") console.error(`[AI Service] API call failed with status ${response.status}:`, errorData);
      return { error: errorData.error || `API request failed with status ${response.status}` };
    }

    const data = await response.json();
    if (process.env.NODE_ENV !== "production") console.log('[AI Service] Received successful API response:', JSON.stringify(data));
    if (process.env.NODE_ENV !== "production") console.log('[AI Service] ⚠️ API RESPONSE RECEIVED - LOADING SHOULD STILL BE TRUE ⚠️');
    
    // Add a small delay before returning so loading state is more visible
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (process.env.NODE_ENV !== "production") console.log('[AI Service] ⚠️ RETURNING RESPONSE - LOADING WILL BE SET TO FALSE ⚠️');
    
    // Return all relevant data from the API response
    return { 
      content: data.message,
      currentQuestionKey: data.currentQuestionKey,
      questionsAnswered: data.questionsAnswered,
      collectedAnswers: data.collectedAnswers,
      isComplete: data.isComplete
    };

  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error('[AI Service] Error in getAIResponse:', error);
    return { error: error.message || 'An unexpected error occurred.' };
  }
} 