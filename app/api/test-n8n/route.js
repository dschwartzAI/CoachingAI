import { NextResponse } from 'next/server';

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

export async function POST(request) {
  try {
    console.log('[TEST-N8N] Starting test...');
    
    if (!N8N_WEBHOOK_URL) {
      console.error('[TEST-N8N] No N8N_WEBHOOK_URL environment variable defined.');
      return NextResponse.json({ 
        error: true, 
        message: 'N8N_WEBHOOK_URL is not defined in environment variables' 
      }, { status: 500 });
    }
    
    console.log(`[TEST-N8N] Will attempt to connect to: ${N8N_WEBHOOK_URL}`);
    
    // Get data from request body if provided, otherwise use test data
    let testData;
    try {
      testData = await request.json();
      console.log('[TEST-N8N] Using data from request body');
    } catch (e) {
      // Create default test data if no body provided
      testData = {
        chatId: 'test-' + Date.now(),
        answers: {
          offerDescription: 'Test offer',
          targetAudience: 'Test audience',
          painPoints: 'Test pain points',
          solution: 'Test solution',
          pricing: 'Test pricing',
          clientResult: 'Test result'
        },
        conversation: [
          { role: 'assistant', content: 'Test question?' },
          { role: 'user', content: 'Test answer' }
        ],
        isTest: true,
        timestamp: new Date().toISOString()
      };
      console.log('[TEST-N8N] Using default test data');
    }
    
    console.log('[TEST-N8N] Sending test payload:', testData);
    
    // Send test request to n8n
    const startTime = Date.now();
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });
    
    const elapsed = Date.now() - startTime;
    console.log(`[TEST-N8N] Received response in ${elapsed}ms with status: ${response.status}`);
    
    let responseData;
    try {
      responseData = await response.json();
      console.log('[TEST-N8N] Received JSON response:', responseData);
    } catch (e) {
      const textResponse = await response.text();
      console.log('[TEST-N8N] Received text response:', textResponse);
      responseData = { text: textResponse };
    }
    
    return NextResponse.json({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      elapsed: elapsed,
      url: N8N_WEBHOOK_URL,
      data: responseData
    });
    
  } catch (error) {
    console.error('[TEST-N8N] Error during test:', error);
    return NextResponse.json({ 
      error: true, 
      message: `Error: ${error.message}`, 
      stack: error.stack 
    }, { status: 500 });
  }
}

// Keep a GET handler for testing in browser, but it redirects to an HTML form
export async function GET(request) {
  return new Response(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Test N8N Connection</title>
        <style>
          body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
          pre { background: #f1f1f1; padding: 1rem; overflow: auto; }
          button { padding: 0.5rem 1rem; background: #0070f3; color: white; border: none; border-radius: 0.25rem; cursor: pointer; }
          button:hover { background: #0051a2; }
          #result { margin-top: 1rem; }
        </style>
      </head>
      <body>
        <h1>Test N8N Connection</h1>
        <p>This page will send a test request to your n8n webhook URL to verify it's working properly.</p>
        <button id="testButton">Run Test</button>
        <div id="result"></div>
        
        <script>
          document.getElementById('testButton').addEventListener('click', async () => {
            const resultDiv = document.getElementById('result');
            resultDiv.innerHTML = '<p>Testing connection...</p>';
            
            try {
              const response = await fetch('/api/test-n8n', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chatId: 'browser-test-' + Date.now(),
                  answers: {
                    offerDescription: 'Test from browser',
                    targetAudience: 'Test audience',
                    painPoints: 'Test pain points',
                    solution: 'Test solution',
                    pricing: 'Test pricing',
                    clientResult: 'Test result'
                  },
                  conversation: [
                    { role: 'assistant', content: 'Test question?' },
                    { role: 'user', content: 'Test answer' }
                  ],
                  isTest: true,
                  timestamp: new Date().toISOString()
                })
              });
              
              const data = await response.json();
              resultDiv.innerHTML = '<h3>Test Result:</h3><pre>' + JSON.stringify(data, null, 2) + '</pre>';
            } catch (error) {
              resultDiv.innerHTML = '<h3>Error:</h3><pre>' + error.toString() + '</pre>';
            }
          });
        </script>
      </body>
    </html>
  `, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
} 