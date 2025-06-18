import { NextResponse } from 'next/server';
import { google } from 'googleapis';

// Rate limiting
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5;

// Clean up old request counts periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of requestCounts.entries()) {
    if (now - data.firstRequest > RATE_LIMIT_WINDOW) {
      requestCounts.delete(key);
    }
  }
}, RATE_LIMIT_WINDOW);

// Rate limiting function
function checkRateLimit(identifier) {
  const now = Date.now();
  const userRequests = requestCounts.get(identifier);
  
  if (!userRequests) {
    requestCounts.set(identifier, { count: 1, firstRequest: now });
    return true;
  }
  
  if (now - userRequests.firstRequest > RATE_LIMIT_WINDOW) {
    requestCounts.set(identifier, { count: 1, firstRequest: now });
    return true;
  }
  
  if (userRequests.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  
  userRequests.count++;
  return true;
}

export async function POST(request) {
  try {
    // Parse request body
    const body = await request.json();
    const { userId, email, category, feedback, userAgent } = body;
    
    // Validate input
    if (!category || !feedback) {
      return NextResponse.json(
        { error: 'Category and feedback are required' },
        { status: 400 }
      );
    }
    
    // Check rate limit using user ID or IP
    const identifier = userId || request.headers.get('x-forwarded-for') || 'anonymous';
    if (!checkRateLimit(identifier)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }
    
    // Validate environment variables
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY || process.env.GOOGLE_SHEETS_PRIVATE_KEY;
    const spreadsheetId = process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    
    // Development mode - log to console if Google Sheets not configured
    if (!clientEmail || !privateKey || !spreadsheetId) {
      console.log('\n=== FEEDBACK RECEIVED (Development Mode) ===');
      console.log('Timestamp:', new Date().toISOString());
      console.log('User ID:', userId || 'anonymous');
      console.log('Email:', email || 'anonymous');
      console.log('Category:', category);
      console.log('Feedback:', feedback);
      console.log('User Agent:', userAgent || 'unknown');
      console.log('===========================================\n');
      
      return NextResponse.json({
        success: true,
        message: 'Feedback received (development mode - check server logs)',
      });
    }
    
    // Initialize Google Sheets API
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey.replace(/\\n/g, '\n'), // Handle escaped newlines
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Prepare data for Google Sheets
    const timestamp = new Date().toISOString();
    const values = [[
      timestamp,
      userId || 'anonymous',
      email || 'anonymous',
      category,
      feedback,
      userAgent || 'unknown',
    ]];
    
    // Append to Google Sheets
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Sheet1!A:F', // Adjust if your sheet has a different name
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });
    
    console.log('Feedback submitted successfully to Google Sheets:', response.data);
    
    return NextResponse.json({
      success: true,
      message: 'Feedback submitted successfully',
    });
    
  } catch (error) {
    console.error('Error submitting feedback:', error);
    
    // Handle specific Google API errors
    if (error.code === 403) {
      return NextResponse.json(
        { error: 'Permission denied. Please check Google Sheets permissions.' },
        { status: 500 }
      );
    }
    
    if (error.code === 404) {
      return NextResponse.json(
        { error: 'Spreadsheet not found. Please check the spreadsheet ID.' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to submit feedback. Please try again.' },
      { status: 500 }
    );
  }
} 