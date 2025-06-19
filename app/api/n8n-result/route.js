import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/utils/supabase';

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

// Update to support both GET and POST methods
export async function POST(request) {
  const sseStartTime = Date.now();
  let chatId;

  try {
    if (process.env.NODE_ENV !== "production") console.log(`\n--- [SSE /api/n8n-result POST Request Start ${sseStartTime}] ---`);
    
    // Validate N8N_WEBHOOK_URL environment variable
    if (!N8N_WEBHOOK_URL) {
      if (process.env.NODE_ENV !== "production") console.error(`[SSE ${sseStartTime}] N8N_WEBHOOK_URL environment variable is not defined.`);
      return new Response(
        `event: error\ndata: ${JSON.stringify({error: "Server configuration error: N8N_WEBHOOK_URL not defined", code: "ENV_MISSING"})}\n\n`,
        { 
          headers: { 
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          }, 
          status: 500 
        }
      );
    }

    // Get data from POST body
    let requestData;
    try {
      requestData = await request.json();
      chatId = requestData.chatId;
      if (process.env.NODE_ENV !== "production") console.log(`[SSE ${chatId || sseStartTime}] Received POST data with fields: ${Object.keys(requestData).join(', ')}`);
    } catch (e) {
      if (process.env.NODE_ENV !== "production") console.error(`[SSE ${sseStartTime}] Failed to parse POST body: ${e.message}`);
      return new Response(
        `event: error\ndata: ${JSON.stringify({error: "Failed to parse request body", code: "INVALID_REQUEST_BODY"})}\n\n`,
        { 
          headers: { 
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          }, 
          status: 400 
        }
      );
    }

    // Extract data from request body
    const { answersData, chatHistory, userId } = requestData;

    if (!chatId) {
      if (process.env.NODE_ENV !== "production") console.error(`[SSE ${sseStartTime}] Error: Missing chatId in request body.`);
      return new Response(
        `event: error\ndata: ${JSON.stringify({error: "Missing chatId in request body", code: "MISSING_CHAT_ID"})}\n\n`,
        { 
          headers: { 
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          }, 
          status: 400 
        }
      );
    }
    
    if (!answersData) {
      if (process.env.NODE_ENV !== "production") console.error(`[SSE ${chatId}] Error: Missing answersData in request body.`);
      return new Response(
        `event: error\ndata: ${JSON.stringify({error: "Missing answersData in request body", code: "MISSING_ANSWERS"})}\n\n`,
        { 
          headers: { 
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          }, 
          status: 400 
        }
      );
    }
    
    if (process.env.NODE_ENV !== "production") console.log(`[SSE ${chatId} ${sseStartTime}] Received chatId: ${chatId}`);
    if (process.env.NODE_ENV !== "production") console.log(`[SSE ${chatId} ${sseStartTime}] Received answersData with ${Object.keys(answersData).length} fields`);
    if (process.env.NODE_ENV !== "production") console.log(`[SSE ${chatId} ${sseStartTime}] Received userId: ${userId || 'none'}`);
    
    if (chatHistory) {
      if (process.env.NODE_ENV !== "production") console.log(`[SSE ${chatId} ${sseStartTime}] Received chatHistory with ${chatHistory.length} messages`);
    } else {
      if (process.env.NODE_ENV !== "production") console.log(`[SSE ${chatId} ${sseStartTime}] No chatHistory received.`);
    }

    // Fetch user's first name from profile
    let firstName = null;
    if (userId && !userId.startsWith('anon-')) {
      try {
        const supabase = createSupabaseClient();
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('full_name')
          .eq('user_id', userId)
          .single();
        
        if (!profileError && profileData?.full_name) {
          // Extract first name from full name
          firstName = profileData.full_name.split(' ')[0];
          if (process.env.NODE_ENV !== "production") console.log(`[SSE ${chatId}] Retrieved first name: ${firstName}`);
        } else {
          if (process.env.NODE_ENV !== "production") console.log(`[SSE ${chatId}] No profile or full name found for user: ${userId}`);
        }
      } catch (profileException) {
        if (process.env.NODE_ENV !== "production") console.error(`[SSE ${chatId}] Error fetching user profile:`, profileException);
      }
    } else {
      if (process.env.NODE_ENV !== "production") console.log(`[SSE ${chatId}] Skipping profile fetch for anonymous or missing user ID`);
    }

    // Create a streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event, data) => {
          try {
            const payload = JSON.stringify(data);
            controller.enqueue(`event: ${event}\ndata: ${payload}\n\n`);
          } catch (error) {
            if (process.env.NODE_ENV !== "production") console.error(`[SSE ${chatId}] Error sending event '${event}':`, error);
          }
        };

        // Send initial processing message
        sendEvent('processing', { 
          status: 'pending', 
          message: "Your document is being generated. This may take 1-3 minutes..." 
        });
        if (process.env.NODE_ENV !== "production") console.log(`[SSE ${chatId}] Sent initial 'processing' event.`);

        // Call n8n webhook directly (synchronous approach)
        try {
          if (process.env.NODE_ENV !== "production") console.log(`[SSE ${chatId} ${sseStartTime}] Calling n8n webhook at: ${N8N_WEBHOOK_URL}`);
          
          const requestBody = {
            chatId: chatId,
            answers: answersData,
            conversation: chatHistory || [],
            timestamp: new Date().toISOString(),
            firstName: firstName // Add first name to the request body
          };
          
          if (process.env.NODE_ENV !== "production") console.log(`[SSE ${chatId}] Sending to N8N with firstName: ${firstName || 'null'}`);
          
          const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });

          const status = n8nResponse.status;
          if (process.env.NODE_ENV !== "production") console.log(`[SSE ${chatId} ${sseStartTime}] Received n8n response status: ${status}`);

          if (!n8nResponse.ok) {
            let errorBody = 'Could not read error body';
            try { 
              errorBody = await n8nResponse.text(); 
            } catch (e) { 
              if (process.env.NODE_ENV !== "production") console.error(`[SSE ${chatId}] Could not read error body:`, e);
            }
            throw new Error(`n8n failed (${status}): ${errorBody}`);
          }

          // Parse JSON response
          const n8nData = await n8nResponse.json();
          if (process.env.NODE_ENV !== "production") console.log(`[SSE ${chatId} ${sseStartTime}] Parsed n8n JSON response successfully.`);

          // Save the document URL as a regular chat message
          if (n8nData.googleDocLink) {
            try {
              const messageContent = `🎉 **Your hybrid offer document is ready!**\n\n📄 **Google Doc:** ${n8nData.googleDocLink}\n\nYou can view, edit, and share this document directly. The link will remain accessible in your chat history.`;
              
              // Save assistant message to database
              const saveResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  messages: [
                    { role: 'assistant', content: messageContent }
                  ],
                  chatId: chatId,
                  tool: 'hybrid-offer',
                  isDocumentResult: true
                })
              });

              if (saveResponse.ok) {
                if (process.env.NODE_ENV !== "production") console.log(`[SSE ${chatId}] Successfully saved document URL as chat message.`);
              } else {
                if (process.env.NODE_ENV !== "production") console.error(`[SSE ${chatId}] Failed to save document URL as chat message:`, await saveResponse.text());
              }
            } catch (saveError) {
              if (process.env.NODE_ENV !== "production") console.error(`[SSE ${chatId}] Error saving document URL as chat message:`, saveError);
            }
          }

          // Send success response
          sendEvent('n8n_result', { success: true, data: n8nData });
          if (process.env.NODE_ENV !== "production") console.log(`[SSE ${chatId}] Sent success result to client.`);

        } catch (error) {
          if (process.env.NODE_ENV !== "production") console.error(`[SSE ${chatId} ${sseStartTime}] Error during n8n call/processing:`, error);
          sendEvent('error', { 
            success: false, 
            message: error.message || 'Failed to process n8n request.',
            code: "N8N_PROCESSING_ERROR"
          });
          if (process.env.NODE_ENV !== "production") console.log(`[SSE ${chatId}] Sent error event to client.`);
        }

        // Close the connection
        try {
          controller.close();
          if (process.env.NODE_ENV !== "production") console.log(`[SSE ${chatId}] Connection closed successfully.`);
        } catch (error) {
          if (process.env.NODE_ENV !== "production") console.error(`[SSE ${chatId}] Error closing connection:`, error);
        }
      },
      cancel() {
        if (process.env.NODE_ENV !== "production") console.log(`[SSE ${chatId || sseStartTime}] Connection closed by client.`);
      }
    });

    // Return the stream
    if (process.env.NODE_ENV !== "production") console.log(`[SSE ${chatId}] Returning SSE stream response.`);
    if (process.env.NODE_ENV !== "production") console.log(`--- [SSE /api/n8n-result POST Request End ${sseStartTime} - Took ${Date.now() - sseStartTime}ms to establish stream] ---`);
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
    
  } catch (outerError) {
    if (process.env.NODE_ENV !== "production") console.error(`[SSE CRITICAL ${chatId || sseStartTime}] Unhandled error in n8n-result handler:`, outerError);
    const errorChatId = chatId || 'unknown_chat_id';
    return new Response(
      `event: error\ndata: ${JSON.stringify({error: "Critical server error", details: outerError.message, code: "UNHANDLED_ERROR", chatId: errorChatId})}\n\n`,
      { 
        headers: { 
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        }, 
        status: 500 
      }
    );
  }
}

// Keep GET method for backward compatibility
export async function GET(request) {
  const sseStartTime = Date.now();
  if (process.env.NODE_ENV !== "production") console.log(`\n--- [SSE /api/n8n-result GET Request Deprecated ${sseStartTime}] ---`);
  if (process.env.NODE_ENV !== "production") console.log(`[SSE ${sseStartTime}] Warning: GET method is deprecated. Please use POST instead.`);
  
  return new Response(
    `event: error\ndata: ${JSON.stringify({error: "GET method is deprecated for this endpoint. Please use POST method.", code: "GET_DEPRECATED"})}\n\n`,
    { 
      headers: { 
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }, 
      status: 405 
    }
  );
} 