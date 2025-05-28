import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request) {
  try {
    // Get the request body
    const body = await request.json();
    const { threadId, runId, chatId } = body;

    if (!threadId || !runId) {
      return NextResponse.json(
        { error: 'Missing required parameters: threadId and runId are required' },
        { status: 400 }
      );
    }

    if (process.env.NODE_ENV !== "production") console.log(`[Assistant Status] Checking run status: ${runId} for thread: ${threadId}`);
    
    // Setup Supabase client
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
    
    // Check the run status
    const runStatus = await openai.beta.threads.runs.retrieve(threadId, runId);
    
    if (process.env.NODE_ENV !== "production") console.log(`[Assistant Status] Current status: ${runStatus.status}`);
    
    if (runStatus.status === "completed") {
      // Get the assistant's response
      if (process.env.NODE_ENV !== "production") console.log(`[Assistant Status] Run completed, retrieving messages`);
      const threadMessages = await openai.beta.threads.messages.list(threadId);
      
      // Filter for assistant messages and get the most recent one
      const assistantMessages = threadMessages.data.filter(msg => msg.role === "assistant");
      
      if (assistantMessages.length === 0) {
        throw new Error("No assistant response received");
      }
      
      // Get the most recent assistant message
      const latestMessage = assistantMessages[0];
      
      // Extract text content from the message
      let responseText = "";
      
      for (const content of latestMessage.content) {
        if (content.type === "text") {
          responseText += content.text.value;
        }
      }
      
      if (process.env.NODE_ENV !== "production") console.log(`[Assistant Status] Response received, length: ${responseText.length}`);
      
      // Save the assistant's response to the database if we have a chatId
      if (chatId) {
        try {
          if (process.env.NODE_ENV !== "production") console.log('[Assistant Status] Saving assistant response to database');
          
          const messageObj = {
            thread_id: chatId,
            role: 'assistant',
            content: responseText,
            timestamp: new Date().toISOString(),
            user_id: userId
          };
          
          const { error: messageError } = await supabase
            .from('messages')
            .insert(messageObj);
            
          if (messageError) {
            if (process.env.NODE_ENV !== "production") console.error('[Assistant Status] Error saving message:', messageError);
          } else {
            if (process.env.NODE_ENV !== "production") console.log('[Assistant Status] Message saved successfully');
          }
        } catch (dbError) {
          if (process.env.NODE_ENV !== "production") console.error('[Assistant Status] Database error:', dbError);
          // Continue even if database operations fail
        }
      }
      
      return NextResponse.json({
        status: "completed",
        message: responseText,
        chatId
      });
    } else if (runStatus.status === "failed" || runStatus.status === "cancelled") {
      if (process.env.NODE_ENV !== "production") console.error(`[Assistant Status] Run failed with status: ${runStatus.status}`);
      return NextResponse.json({
        status: runStatus.status,
        error: `Assistant run ${runStatus.status}: ${runStatus.last_error?.message || "Unknown error"}`,
        chatId
      }, { status: 500 });
    } else {
      // Still in progress
      return NextResponse.json({
        status: runStatus.status,
        chatId,
        message: "Assistant is still processing your message..."
      });
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error('[Assistant Status] Error:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while checking status' },
      { status: 500 }
    );
  }
} 