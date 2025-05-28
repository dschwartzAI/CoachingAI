import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { chatId, documentUrl, testMode } = await request.json();
    
    if (!chatId) {
      return NextResponse.json({ error: 'Missing chatId' }, { status: 400 });
    }
    
    console.log(`[TEST_N8N_CALLBACK] Testing direct n8n result for chatId: ${chatId}`);
    
    // Simulate n8n response data (what n8n would return)
    const mockN8nData = {
      googleDocLink: documentUrl || 'https://docs.google.com/document/d/test-document-id/edit',
      success: true,
      message: 'Document generated successfully'
    };
    
    console.log(`[TEST_N8N_CALLBACK] Simulating n8n response:`, mockN8nData);
    
    // Test the n8n-result endpoint directly with mock data
    const testData = {
      chatId: chatId,
      answersData: {
        offerDescription: 'Test offer',
        targetAudience: 'Test audience',
        painPoints: 'Test pain points',
        solution: 'Test solution',
        pricing: 'Test pricing',
        clientResult: 'Test client result'
      },
      chatHistory: []
    };
    
    console.log(`[TEST_N8N_CALLBACK] Testing n8n-result endpoint with data:`, testData);
    
    return NextResponse.json({
      success: true,
      message: 'Test data prepared for n8n-result endpoint',
      mockN8nData: mockN8nData,
      testInstructions: 'Use the n8n-result endpoint directly with POST request',
      testEndpoint: '/api/n8n-result',
      testData: testData
    });
    
  } catch (error) {
    console.error(`[TEST_N8N_CALLBACK] Error:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  return NextResponse.json({
    message: 'Test endpoint for n8n result system',
    usage: 'POST with { "chatId": "your-chat-id", "documentUrl": "optional-test-url" }',
    note: 'This endpoint now works with the synchronous n8n-result system'
  });
} 