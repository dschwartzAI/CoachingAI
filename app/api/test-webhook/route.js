import { NextResponse } from 'next/server';

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

export async function POST(request) {
  try {
    if (!N8N_WEBHOOK_URL) {
      return NextResponse.json({ error: "N8N_WEBHOOK_URL not configured" }, { status: 500 });
    }

    // Get the test data from the request or use the last known data
    const { testData } = await request.json();
    
    // Use the collected answers from the logs as default test data
    const defaultTestData = {
      chatId: "33421088-dbf1-4be8-94f0-12878fc12dd8",
      answers: {
        offerType: "service with a membership component",
        offerDescription: "We show B2B service business founders how to automate their content with AI.",
        targetAudience: "same as my ideal client profile",
        painPoints: "They are afraid of staying relevant, having competition beat them because they use AI, and that they don't have the discipline to commit to a content strategy.",
        promiseSolution: "They'll have an AI content blueprint that can serve as an evergreen lead-getting powerhouse that speaks directly to their ideal clients and generates customers and clients on autopilot, positioning them as a key thought leader in their niche.",
        clientResult: "Increased a client's sales by 30% in the first quarter.",
        uniqueMechanism: "1. Big idea messaging 2. Competitive research 3. Idea Generation 4. Content Creation 5. Auto-Distribution",
        phases: "1. Competitive keyword research 2. Ideation 3. AI Content Creation 4. Auto-Distribution",
        guaranteeScarcity: "We guarantee results within 90 days or we'll work with you for free until you get them. Limited to 10 clients per quarter.",
        paymentTerms: "Monthly payment plan available with 3-month minimum commitment"
      },
      conversation: [],
      timestamp: new Date().toISOString(),
      firstName: "Daniel"
    };

    const webhookData = testData || defaultTestData;

    console.log('[Test Webhook] Sending data to N8N:', JSON.stringify(webhookData, null, 2));

    // Send to N8N webhook
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookData)
    });

    const responseText = await n8nResponse.text();
    console.log('[Test Webhook] N8N Response Status:', n8nResponse.status);
    console.log('[Test Webhook] N8N Response Body:', responseText);

    if (!n8nResponse.ok) {
      return NextResponse.json({ 
        error: `N8N webhook failed with status ${n8nResponse.status}`, 
        response: responseText 
      }, { status: 500 });
    }

    let n8nData;
    try {
      n8nData = JSON.parse(responseText);
    } catch (e) {
      console.log('[Test Webhook] Response was not JSON, treating as text');
      n8nData = { response: responseText };
    }

    return NextResponse.json({ 
      success: true, 
      webhookData: webhookData,
      n8nResponse: n8nData 
    });

  } catch (error) {
    console.error('[Test Webhook] Error:', error);
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    if (!N8N_WEBHOOK_URL) {
      return NextResponse.json({ error: "N8N_WEBHOOK_URL not configured" }, { status: 500 });
    }

    // Minimal test data with firstName
    const minimalTestData = {
      chatId: "test-minimal",
      answers: {
        offerType: "coaching",
        offerDescription: "Test coaching service"
      },
      conversation: [],
      timestamp: new Date().toISOString(),
      firstName: "TestUser"
    };

    console.log('[Test Webhook] Sending minimal data to N8N:', JSON.stringify(minimalTestData, null, 2));

    // Send to N8N webhook
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(minimalTestData)
    });

    const responseText = await n8nResponse.text();
    console.log('[Test Webhook] N8N Response Status:', n8nResponse.status);
    console.log('[Test Webhook] N8N Response Body:', responseText);

    let n8nData;
    try {
      n8nData = JSON.parse(responseText);
    } catch (e) {
      console.log('[Test Webhook] Response was not JSON, treating as text');
      n8nData = { response: responseText };
    }

    return NextResponse.json({ 
      success: true, 
      testData: minimalTestData,
      n8nResponse: n8nData 
    });

  } catch (error) {
    console.error('[Test Webhook] Error:', error);
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
} 