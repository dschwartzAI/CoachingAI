import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request) {
  try {
    const body = await request.json();
    const { assistantId, message } = body;

    if (!assistantId || !message) {
      return NextResponse.json(
        { error: 'Missing required parameters: assistantId and message are required' },
        { status: 400 }
      );
    }

    if (process.env.NODE_ENV !== "production") console.log(`[Assistant Direct] Starting request with assistantId: ${assistantId}`);
    if (process.env.NODE_ENV !== "production") console.log(`[Assistant Direct] User message: ${message}`);
    
    // Create a thread
    if (process.env.NODE_ENV !== "production") console.log(`[Assistant Direct] Creating thread`);
    const thread = await openai.beta.threads.create();
    
    // Add the user message to the thread
    if (process.env.NODE_ENV !== "production") console.log(`[Assistant Direct] Adding message to thread: ${thread.id}`);
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: message, // Send the exact message without modifications
    });
    
    // Run the assistant on the thread
    if (process.env.NODE_ENV !== "production") console.log(`[Assistant Direct] Running assistant: ${assistantId}`);
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId,
    });
    
    // Poll for the completion
    let completedRun;
    while (true) {
      if (process.env.NODE_ENV !== "production") console.log(`[Assistant Direct] Checking run status: ${run.id}`);
      const runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      
      if (runStatus.status === 'completed') {
        if (process.env.NODE_ENV !== "production") console.log(`[Assistant Direct] Run completed successfully`);
        completedRun = runStatus;
        break;
      } else if (runStatus.status === 'failed' || runStatus.status === 'cancelled') {
        if (process.env.NODE_ENV !== "production") console.error(`[Assistant Direct] Run failed with status: ${runStatus.status}`);
        throw new Error(`Assistant run failed with status: ${runStatus.status}`);
      }
      
      // Wait 1 second before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Get the assistant's messages
    if (process.env.NODE_ENV !== "production") console.log(`[Assistant Direct] Retrieving messages from thread: ${thread.id}`);
    const messages = await openai.beta.threads.messages.list(thread.id);
    
    // Filter for assistant messages and get the most recent one
    const assistantMessages = messages.data.filter(msg => msg.role === 'assistant');
    
    if (assistantMessages.length === 0) {
      throw new Error('No assistant response received');
    }
    
    // Get the most recent assistant message
    const latestMessage = assistantMessages[0];
    
    // Extract text content from the message
    let responseText = '';
    
    for (const content of latestMessage.content) {
      if (content.type === 'text') {
        responseText += content.text.value;
      }
    }
    
    if (process.env.NODE_ENV !== "production") console.log(`[Assistant Direct] Sending response back to client`);
    
    return NextResponse.json({
      threadId: thread.id,
      runId: run.id,
      response: responseText,
    });
    
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error('[Assistant Direct] Error:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while processing the request' },
      { status: 500 }
    );
  }
} 