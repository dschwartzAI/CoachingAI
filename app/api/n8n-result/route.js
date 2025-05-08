import { NextResponse } from 'next/server';
// No longer need tempStore
// import { retrieveTaskData, removeTaskData } from '@/lib/tempStore'; 

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

export async function GET(request) {
  const sseStartTime = Date.now();
  console.log(`
--- [SSE /api/n8n-result GET Request Start ${sseStartTime}] ---`);
  console.log(`[SSE ${sseStartTime}] Request URL: ${request.url}`);

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');
  const answersDataString = searchParams.get('answersData'); 
  const chatHistoryString = searchParams.get('chatHistory');

  if (!chatId) {
    console.error(`[SSE ${sseStartTime}] Error: Missing chatId parameter.`);
    return new Response('Missing chatId parameter', { status: 400 });
  }
  if (!answersDataString) {
     console.error(`[SSE ${chatId} ${sseStartTime}] Error: Missing answersData parameter.`);
     return new Response('Missing answersData parameter', { status: 400 });
  }
  console.log(`[SSE ${chatId} ${sseStartTime}] Received chatId: ${chatId}`);
  console.log(`[SSE ${chatId} ${sseStartTime}] Received answersData string: ${answersDataString}`);

  let collectedAnswers;
  try {
      collectedAnswers = JSON.parse(answersDataString);
      console.log(`[SSE ${chatId} ${sseStartTime}] Successfully parsed answers JSON:`, collectedAnswers);
  } catch (e) {
      console.error(`[SSE ${chatId} ${sseStartTime}] Failed to JSON.parse received data string:`, e);
      const stream = new ReadableStream({ start(controller) { controller.enqueue(`event: error\ndata: ${JSON.stringify({error: "Failed to parse answer data."})}\n\n`); controller.close(); } });
      return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', status: 400 } }); 
  }

  if (!collectedAnswers || typeof collectedAnswers !== 'object' || Object.keys(collectedAnswers).length === 0) {
      console.error(`[SSE ${chatId} ${sseStartTime}] Parsed answers are empty or invalid object.`);
      const stream = new ReadableStream({ start(controller) { controller.enqueue(`event: error\ndata: ${JSON.stringify({error: "Parsed answer data is invalid or empty."})}\n\n`); controller.close(); } });
       return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', status: 400 } });
  }

  // Create a streaming response
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event, data) => {
        const payload = JSON.stringify(data);
        controller.enqueue(`event: ${event}\ndata: ${payload}\n\n`);
      };

      // Parse chatHistory (moved inside start function)
      let conversationHistory = [];
      if (chatHistoryString) {
        try {
          conversationHistory = JSON.parse(decodeURIComponent(chatHistoryString));
          console.log(`[SSE ${chatId} ${sseStartTime}] Successfully parsed chatHistory JSON:`, conversationHistory.length > 0 ? `${conversationHistory.length} messages` : "empty");
        } catch (e) {
          console.error(`[SSE ${chatId} ${sseStartTime}] Failed to JSON.parse chatHistory string:`, e);
          sendEvent('error', { success: false, message: 'Failed to parse conversation history. Proceeding without it.' });
          // Not closing controller here, will proceed to call n8n without history
        }
      }

      try {
        console.log(`[SSE ${chatId} ${sseStartTime}] Calling n8n webhook...`);
        const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: chatId,
            answers: collectedAnswers, // Use answers from URL
            conversation: conversationHistory // Add parsed conversation history
          }), 
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
        sendEvent('error', { success: false, message: error.message || 'Failed to process n8n request.' });
        console.log(`[SSE ${chatId} ${sseStartTime}] Sent error event to client.`);
      
      } finally {
        // No need to remove from store, just close connection
        console.log(`[SSE ${chatId} ${sseStartTime}] Closing connection.`);
        controller.close();
      }
    }
  });

  // Return the stream
  console.log(`[SSE ${chatId} ${sseStartTime}] Returning SSE stream response.`);
  console.log(`--- [SSE /api/n8n-result GET Request End ${sseStartTime} - Took ${Date.now() - sseStartTime}ms (before stream finishes)] ---`);
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
} 