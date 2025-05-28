const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

exports.handler = async function(event, context) {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  };

  // Handle OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  const sseStartTime = Date.now();
  
  try {
    if (process.env.NODE_ENV !== "production") console.log(`\n--- [SSE /api/n8n-result Request Start ${sseStartTime}] ---`);
    
    // Validate N8N_WEBHOOK_URL environment variable
    if (!N8N_WEBHOOK_URL) {
      if (process.env.NODE_ENV !== "production") console.error(`[SSE ${sseStartTime}] N8N_WEBHOOK_URL environment variable is not defined.`);
      return {
        statusCode: 500,
        headers,
        body: `event: error\ndata: ${JSON.stringify({error: "Server configuration error: N8N_WEBHOOK_URL not defined", code: "ENV_MISSING"})}\n\n`
      };
    }

    // Get data from request body
    let requestData;
    try {
      requestData = JSON.parse(event.body);
      if (process.env.NODE_ENV !== "production") console.log(`[SSE ${sseStartTime}] Received request data with fields: ${Object.keys(requestData).join(', ')}`);
    } catch (e) {
      if (process.env.NODE_ENV !== "production") console.error(`[SSE ${sseStartTime}] Failed to parse request body: ${e.message}`);
      return {
        statusCode: 400,
        headers,
        body: `event: error\ndata: ${JSON.stringify({error: "Failed to parse request body", code: "INVALID_REQUEST_BODY"})}\n\n`
      };
    }

    // Extract data from request body
    const { chatId, answersData, chatHistory } = requestData;

    if (!chatId) {
      if (process.env.NODE_ENV !== "production") console.error(`[SSE ${sseStartTime}] Error: Missing chatId in request body.`);
      return {
        statusCode: 400,
        headers,
        body: `event: error\ndata: ${JSON.stringify({error: "Missing chatId in request body", code: "MISSING_CHAT_ID"})}\n\n`
      };
    }

    if (!answersData) {
      if (process.env.NODE_ENV !== "production") console.error(`[SSE ${chatId} ${sseStartTime}] Error: Missing answersData in request body.`);
      return {
        statusCode: 400,
        headers,
        body: `event: error\ndata: ${JSON.stringify({error: "Missing answersData in request body", code: "MISSING_ANSWERS"})}\n\n`
      };
    }

    if (process.env.NODE_ENV !== "production") console.log(`[SSE ${chatId} ${sseStartTime}] Received chatId: ${chatId}`);
    if (process.env.NODE_ENV !== "production") console.log(`[SSE ${chatId} ${sseStartTime}] Received answersData with ${Object.keys(answersData).length} fields`);
    
    if (chatHistory) {
      if (process.env.NODE_ENV !== "production") console.log(`[SSE ${chatId} ${sseStartTime}] Received chatHistory with ${chatHistory.length} messages`);
    } else {
      if (process.env.NODE_ENV !== "production") console.log(`[SSE ${chatId} ${sseStartTime}] No chatHistory received.`);
    }

    // Call n8n webhook
    try {
      if (process.env.NODE_ENV !== "production") console.log(`[SSE ${chatId} ${sseStartTime}] Calling n8n webhook at: ${N8N_WEBHOOK_URL}`);
      
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
      if (process.env.NODE_ENV !== "production") console.log(`[SSE ${chatId} ${sseStartTime}] Received n8n response status: ${status}`);

      if (!n8nResponse.ok) {
        let errorBody = 'Could not read error body';
        try { errorBody = await n8nResponse.text(); } catch (e) { /* ignore */ }
        throw new Error(`n8n failed (${status}): ${errorBody}`);
      }

      // Parse JSON response
      const n8nData = await n8nResponse.json();
      if (process.env.NODE_ENV !== "production") console.log(`[SSE ${chatId} ${sseStartTime}] Parsed n8n JSON response successfully.`);

      // Return success response
      return {
        statusCode: 200,
        headers,
        body: `event: n8n_result\ndata: ${JSON.stringify({ success: true, data: n8nData })}\n\n`
      };

    } catch (error) {
      if (process.env.NODE_ENV !== "production") console.error(`[SSE ${chatId} ${sseStartTime}] Error during n8n call/processing:`, error);
      return {
        statusCode: 500,
        headers,
        body: `event: error\ndata: ${JSON.stringify({ 
          success: false, 
          message: error.message || 'Failed to process n8n request.',
          code: "N8N_PROCESSING_ERROR"
        })}\n\n`
      };
    }

  } catch (outerError) {
    if (process.env.NODE_ENV !== "production") console.error(`[SSE CRITICAL ${sseStartTime}] Unhandled error in n8n-result handler:`, outerError);
    return {
      statusCode: 500,
      headers,
      body: `event: error\ndata: ${JSON.stringify({
        error: "Critical server error", 
        details: outerError.message, 
        code: "UNHANDLED_ERROR"
      })}\n\n`
    };
  }
}; 