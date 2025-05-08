import { NextResponse } from 'next/server';
// No longer need tempStore
// import { retrieveTaskData, removeTaskData } from '@/lib/tempStore'; 

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

// Update to support both GET and POST methods
export async function POST(request) {
  const sseStartTime = Date.now();
  
  try {
    console.log(`\n--- [SSE /api/n8n-result POST Request Start ${sseStartTime}] ---`);
    
    // Validate N8N_WEBHOOK_URL environment variable
    if (!N8N_WEBHOOK_URL) {
      console.error(`[SSE ${sseStartTime}] N8N_WEBHOOK_URL environment variable is not defined.`);
      return new Response(
        `event: error\ndata: ${JSON.stringify({error: "Server configuration error: N8N_WEBHOOK_URL not defined", code: "ENV_MISSING"})}\n\n`,
        { headers: { 'Content-Type': 'text/event-stream' }, status: 500 }
      );
    }

    // Get data from POST body instead of URL params
    let requestData;
    try {
      requestData = await request.json();
      console.log(`[SSE ${sseStartTime}] Received POST data with fields: ${Object.keys(requestData).join(', ')}`);
    } catch (e) {
      console.error(`[SSE ${sseStartTime}] Failed to parse POST body: ${e.message}`);
      return new Response(
        `event: error\ndata: ${JSON.stringify({error: "Failed to parse request body", code: "INVALID_REQUEST_BODY"})}\n\n`,
        { headers: { 'Content-Type': 'text/event-stream' }, status: 400 }
      );
    }

    // Extract data from request body
    const { chatId, answersData, chatHistory } = requestData;

    if (!chatId) {
      console.error(`[SSE ${sseStartTime}] Error: Missing chatId in request body.`);
      return new Response(
        `event: error\ndata: ${JSON.stringify({error: "Missing chatId in request body", code: "MISSING_CHAT_ID"})}\n\n`,
        { headers: { 'Content-Type': 'text/event-stream' }, status: 400 }
      );
    }
    if (!answersData) {
      console.error(`[SSE ${chatId} ${sseStartTime}] Error: Missing answersData in request body.`);
      return new Response(
        `event: error\ndata: ${JSON.stringify({error: "Missing answersData in request body", code: "MISSING_ANSWERS"})}\n\n`,
        { headers: { 'Content-Type': 'text/event-stream' }, status: 400 }
      );
    }
    
    console.log(`[SSE ${chatId} ${sseStartTime}] Received chatId: ${chatId}`);
    console.log(`[SSE ${chatId} ${sseStartTime}] Received answersData with ${Object.keys(answersData).length} fields`);
    
    if (chatHistory) {
      console.log(`[SSE ${chatId} ${sseStartTime}] Received chatHistory with ${chatHistory.length} messages`);
    } else {
      console.log(`[SSE ${chatId} ${sseStartTime}] No chatHistory received.`);
    }

    // Create a streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event, data) => {
          const payload = JSON.stringify(data);
          controller.enqueue(`event: ${event}\ndata: ${payload}\n\n`);
        };

        try {
          console.log(`[SSE ${chatId} ${sseStartTime}] Calling n8n webhook at: ${N8N_WEBHOOK_URL}`);
          console.log(`[SSE ${chatId} ${sseStartTime}] Payload for n8n:`, {
            chatId,
            answersCount: Object.keys(answersData).length, 
            conversationCount: chatHistory ? chatHistory.length : 0
          });
          
          const requestBody = {
            chatId: chatId,
            answers: answersData,
            conversation: chatHistory || [],
            timestamp: new Date().toISOString()
          };
          
          const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });

          const status = n8nResponse.status;
          console.log(`[SSE ${chatId} ${sseStartTime}] Received n8n response status: ${status}`);

          if (!n8nResponse.ok) {
            let errorBody = 'Could not read error body';
            try { errorBody = await n8nResponse.text(); } catch (e) { /* ignore */ }
            throw new Error(`n8n failed (${status}): ${errorBody}`);
          }

          // Attempt to parse JSON
          let n8nData;
          try {
            n8nData = await n8nResponse.json();
            console.log(`[SSE ${chatId} ${sseStartTime}] Parsed n8n JSON response successfully.`);
          } catch (parseError) {
            console.warn(`[SSE ${chatId} ${sseStartTime}] Failed to parse n8n response as JSON:`, parseError.message);
            // Potentially try reading as text or just send an error/raw data
            throw new Error(`n8n returned non-JSON response.`); 
          }

          // Send the successful result back to the client
          sendEvent('n8n_result', { success: true, data: n8nData });
          console.log(`[SSE ${chatId} ${sseStartTime}] Sent n8n_result event to client.`);

        } catch (error) {
          console.error(`[SSE ${chatId} ${sseStartTime}] Error during n8n call/processing:`, error);
          // Send an error event to the client
          sendEvent('error', { 
            success: false, 
            message: error.message || 'Failed to process n8n request.',
            code: "N8N_PROCESSING_ERROR"
          });
          console.log(`[SSE ${chatId} ${sseStartTime}] Sent error event to client.`);
        
        } finally {
          console.log(`[SSE ${chatId} ${sseStartTime}] Closing connection.`);
          controller.close();
        }
      }
    });

    // Return the stream
    console.log(`[SSE ${chatId} ${sseStartTime}] Returning SSE stream response.`);
    console.log(`--- [SSE /api/n8n-result POST Request End ${sseStartTime} - Took ${Date.now() - sseStartTime}ms] ---`);
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
    
  } catch (outerError) {
    // This is a global catch-all for any unexpected errors in the main handler
    console.error(`[SSE CRITICAL ${sseStartTime}] Unhandled error in n8n-result handler:`, outerError);
    return new Response(
      `event: error\ndata: ${JSON.stringify({error: "Critical server error", details: outerError.message, code: "UNHANDLED_ERROR"})}\n\n`,
      { headers: { 'Content-Type': 'text/event-stream' }, status: 500 }
    );
  }
}

// Keep GET method for backward compatibility and testing
export async function GET(request) {
  const sseStartTime = Date.now();
  console.log(`\n--- [SSE /api/n8n-result GET Request Deprecated ${sseStartTime}] ---`);
  console.log(`[SSE ${sseStartTime}] Warning: GET method is deprecated. Please use POST instead.`);
  
  return new Response(
    `event: error\ndata: ${JSON.stringify({error: "GET method is deprecated for this endpoint due to URL length limitations. Please use POST method.", code: "GET_DEPRECATED"})}\n\n`,
    { headers: { 'Content-Type': 'text/event-stream' }, status: 400 }
  );
} 