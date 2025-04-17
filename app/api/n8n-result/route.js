import { NextResponse } from 'next/server';
// No longer need tempStore
// import { retrieveTaskData, removeTaskData } from '@/lib/tempStore'; 

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');
  const encodedAnswersData = searchParams.get('answersData'); // Get encoded data

  if (!chatId || !encodedAnswersData) {
    return new Response('Missing chatId or answersData parameter', { status: 400 });
  }

  let collectedAnswers;
  try {
      collectedAnswers = JSON.parse(decodeURIComponent(encodedAnswersData));
      console.log(`[SSE ${chatId}] Successfully decoded answers from query params:`, collectedAnswers);
  } catch (e) {
      console.error(`[SSE ${chatId}] Failed to decode/parse answersData from query param:`, e);
      return new Response('Invalid answersData format', { status: 400 });
  }

  // Check if we got a valid object
  if (!collectedAnswers || typeof collectedAnswers !== 'object' || Object.keys(collectedAnswers).length === 0) {
      console.error(`[SSE ${chatId}] Decoded answers are empty or invalid.`);
       // Send error event back to client
       const stream = new ReadableStream({
         start(controller) {
           const errorPayload = JSON.stringify({ error: "Session data expired or not found. Please try again." });
           controller.enqueue(`event: error\ndata: ${errorPayload}\n\n`);
           controller.close();
         }
       });
       return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
  }

  // Create a streaming response
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event, data) => {
        const payload = JSON.stringify(data);
        controller.enqueue(`event: ${event}\ndata: ${payload}\n\n`);
      };

      try {
        console.log(`[SSE ${chatId}] Data retrieved from URL. Calling n8n webhook...`);
        const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(collectedAnswers), // Use answers from URL
        });

        const status = n8nResponse.status;
        console.log(`[SSE ${chatId}] Received n8n response status: ${status}`);

        if (!n8nResponse.ok) {
            let errorBody = 'Could not read error body';
            try { errorBody = await n8nResponse.text(); } catch (e) { /* ignore */ }
            throw new Error(`n8n failed (${status}): ${errorBody}`);
        }

        // Attempt to parse JSON
        let n8nData;
        try {
            n8nData = await n8nResponse.json();
            console.log(`[SSE ${chatId}] Parsed n8n JSON response successfully.`);
        } catch (parseError) {
            console.warn(`[SSE ${chatId}] Failed to parse n8n response as JSON:`, parseError.message);
            // Potentially try reading as text or just send an error/raw data
            throw new Error(`n8n returned non-JSON response.`); 
        }

        // Send the successful result back to the client
        sendEvent('n8n_result', { success: true, data: n8nData });
        console.log(`[SSE ${chatId}] Sent n8n_result event to client.`);

      } catch (error) {
        console.error(`[SSE ${chatId}] Error during n8n call or processing:`, error);
        // Send an error event to the client
        sendEvent('error', { success: false, message: error.message || 'Failed to process n8n request.' });
        console.log(`[SSE ${chatId}] Sent error event to client.`);
      
      } finally {
        // No need to remove from store, just close connection
        console.log(`[SSE ${chatId}] Closing connection.`);
        controller.close();
      }
    }
  });

  // Return the stream
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
} 