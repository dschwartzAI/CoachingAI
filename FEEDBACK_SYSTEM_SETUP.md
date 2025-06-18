# Feedback System Setup Guide

## Overview
The feedback system allows users to submit feedback directly from the chat app, which is automatically stored in a Google Sheets spreadsheet.

## Features
- **Feedback Button**: Located in the top-right corner next to the notification bell
- **Category Selection**: Bug Report, Feature Request, or General Feedback
- **Rate Limiting**: Prevents spam (5 requests per minute per user)
- **Google Sheets Integration**: Automatically stores feedback with timestamps
- **User-Friendly UI**: Clean modal with validation and loading states

## Google Sheets Setup

### 1. Create a Google Spreadsheet
1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet
3. Name it "CoachingAI Feedback" (or any name you prefer)
4. Set up the header row with these columns:
   - A1: `Timestamp`
   - B1: `User ID`
   - C1: `Email`
   - D1: `Category`
   - E1: `Feedback`
   - F1: `User Agent`

### 2. Get the Spreadsheet ID
1. Open your spreadsheet
2. Copy the ID from the URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
3. Save this ID for the environment variables

### 3. Create a Google Service Account
1. Go to the [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Enable the Google Sheets API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Sheets API"
   - Click "Enable"

4. Create a service account:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "Service Account"
   - Give it a name like "feedback-service"
   - Click "Create and Continue"
   - Skip role assignment for now
   - Click "Done"

5. Create a key for the service account:
   - Click on the service account you just created
   - Go to the "Keys" tab
   - Click "Add Key" > "Create New Key"
   - Choose "JSON" format
   - Download the key file

### 4. Share the Spreadsheet
1. Open your Google Spreadsheet
2. Click the "Share" button
3. Add the service account email (from the JSON key file) as an editor
4. The email will look like: `feedback-service@your-project.iam.gserviceaccount.com`

## Environment Variables Setup

Add these variables to your `.env.local` file:

```bash
# Google Sheets Feedback Integration
GOOGLE_SHEETS_CLIENT_EMAIL=your-service-account-email@your-project.iam.gserviceaccount.com
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_SPREADSHEET_ID=your-spreadsheet-id-here
```

### Getting the Values:
1. **GOOGLE_SHEETS_CLIENT_EMAIL**: Copy the `client_email` from your downloaded JSON key file
2. **GOOGLE_SHEETS_PRIVATE_KEY**: Copy the `private_key` from your downloaded JSON key file (keep the quotes and newlines)
3. **GOOGLE_SHEETS_SPREADSHEET_ID**: The ID from your spreadsheet URL

## Testing the System

1. Start your development server: `npm run dev`
2. Look for the "Feedback" button in the top-right corner
3. Click it and submit test feedback
4. Check your Google Spreadsheet to see if the feedback appears

## Troubleshooting

### Common Issues:

1. **"Permission denied" error**:
   - Make sure you shared the spreadsheet with the service account email
   - Verify the service account has "Editor" permissions

2. **"Spreadsheet not found" error**:
   - Double-check the spreadsheet ID in your environment variables
   - Make sure the spreadsheet exists and is accessible

3. **"Authentication failed" error**:
   - Verify the service account credentials are correct
   - Make sure the private key includes the proper newline characters
   - Check that the Google Sheets API is enabled in your Google Cloud project

4. **Rate limiting errors**:
   - The system allows 5 requests per minute per user
   - Wait a minute before trying again, or adjust the rate limit in the API code

### Checking Logs:
- Check the browser console for client-side errors
- Check the server logs (terminal where you run `npm run dev`) for API errors
- Look for detailed error messages that can help identify the specific issue

## Security Notes

- The service account key contains sensitive information - never commit it to version control
- The private key in the environment variable should be properly escaped
- Rate limiting helps prevent abuse of the feedback system
- User data is only stored in your Google Spreadsheet, which you control

## Customization

### Adding More Categories:
Edit the `FEEDBACK_CATEGORIES` array in `components/FeedbackModal.js`:

```javascript
const FEEDBACK_CATEGORIES = [
  { value: "bug", label: "Bug Report" },
  { value: "feature", label: "Feature Request" },
  { value: "general", label: "General Feedback" },
  { value: "ui", label: "UI/UX Feedback" },
  { value: "performance", label: "Performance Issue" },
];
```

### Changing Rate Limits:
Modify the constants in `app/api/feedback/route.js`:

```javascript
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5; // 5 requests per window
```

### Styling Changes:
The feedback button and modal use the existing design system. You can customize the styling by modifying the className props in the components. 