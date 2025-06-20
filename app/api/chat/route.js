import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { createServerClientWithCookies } from '@/lib/utils/supabaseServer';
import { NextResponse } from 'next/server';
import { TOOLS, getNextQuestion } from '@/lib/config/tools';
import { hybridOfferQuestions, workshopQuestions } from '@/lib/config/questions';
import { v4 as uuidv4 } from 'uuid';
import { getUserProfile } from '@/lib/utils/supabase';
import { buildProfileContext } from '@/lib/utils/ai';
import { createSessionSummary, getCoachingContext, getMessageCount, createToolMemorySummary } from '@/lib/utils/memory';
import { generateThreadTitle } from '@/lib/utils/thread';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
// Add your GPT Assistant ID here
const GPT_ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID;

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

// Helper function to detect and save ideal client profiles from ICP tool responses
async function detectAndSavePsychographicBrief(responseContent, userId) {
  try {
    // Detection criteria for comprehensive ideal client profiles
    const isPsychographicBrief = (
      responseContent.length > 1500 && // Must be substantial content
      (
        /ideal\s+client\s+profile/i.test(responseContent) || // Contains "ideal client profile"
        /ideal\s+client\s+psychographic/i.test(responseContent) || // Contains "ideal client psychographic"
        (/demographics/i.test(responseContent) && /pain\s+points/i.test(responseContent)) || // Has both demographics and pain points
        (/core\s+demographics/i.test(responseContent) && /goals\s+and\s+aspirations/i.test(responseContent)) // Structured format
      )
    );

    if (!isPsychographicBrief) {
      console.log('[CHAT_API_DEBUG] Response does not appear to be a comprehensive ideal client profile');
      return;
    }

    console.log('[CHAT_API_DEBUG] Comprehensive ideal client profile detected, saving to user profile');
    
    const supabase = createServerClientWithCookies();
    
    // Update the user's profile with the ideal client profile
    const { error } = await supabase
      .from('user_profiles')
      .update({ 
        ideal_client_profile: responseContent,
        ideal_client_profile_updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);
    
    if (error) {
      console.error('[CHAT_API_DEBUG] Error saving ideal client profile to profile:', error);
      return false;
    }
    
    console.log('[CHAT_API_DEBUG] Ideal client profile saved successfully to user profile');
    return true;
  } catch (error) {
    console.error('[CHAT_API_DEBUG] Error in detectAndSavePsychographicBrief:', error);
    return false;
  }
}

// Add a function to validate answers using AI
async function validateHybridOfferAnswer(questionKey, answer, userProfile = null) {
  if (!answer || answer.trim().length < 3) {
    return {
      isValid: false,
      reason: "The answer is too short to provide meaningful information."
    };
  }

  // Special validation for targetAudience - check if user has ideal client profile
  if (questionKey === 'targetAudience') {
    // Accept "same as my ideal client profile" or similar variations
    const normalizedAnswer = answer.toLowerCase().trim();
    const referencesIdealClientProfile = 
      normalizedAnswer.includes('same as') && (normalizedAnswer.includes('profile') || normalizedAnswer.includes('client')) ||
      normalizedAnswer.includes('same as my profile') ||
      normalizedAnswer.includes('as per my profile') ||
      normalizedAnswer.includes('see my profile') ||
      normalizedAnswer.includes('check my profile') ||
      normalizedAnswer.includes('yes the same') ||
      normalizedAnswer.includes('same') ||
      normalizedAnswer.includes('yes same') ||
      normalizedAnswer.includes('the same') ||
      normalizedAnswer === 'yes' ||
      normalizedAnswer.includes('my profile') ||
      normalizedAnswer.includes('ideal client');
    
    if (referencesIdealClientProfile && userProfile?.ideal_client_profile) {
      // User is referencing their existing profile, and they have one - this is valid
      return { isValid: true, reason: null };
    }
    
    if (!userProfile?.ideal_client_profile) {
      return {
        isValid: false,
        reason: "Please complete your ideal client profile first using the Ideal Client Extractor tool. This will help ensure your target audience is properly defined for your hybrid offer.",
        needsIdealClientProfile: true
      };
    }
  }

  // Special validation for offerType - be lenient and let N8N classifier handle it
  if (questionKey === 'offerType') {
    // As long as they describe something about their offer type, accept it
    if (answer.trim().length >= 5) {
      console.log(`[Chat API] Auto-accepting offerType for N8N classification: "${answer}"`);
      return { isValid: true, reason: null, topic: "offer type" };
    } else {
      return {
        isValid: false,
        reason: "Please describe your offer type in a bit more detail so I can understand what you're creating.",
        topic: "offer type"
      };
    }
  }

  // For offerDescription, if the answer is short (e.g., just a service name),
  // consider it valid without extensive AI validation.
  if (questionKey === 'offerDescription' && answer.trim().length < 50 && answer.trim().split(' ').length <= 5) {
    console.log(`[Chat API] Skipping extensive AI validation for short offerDescription: "${answer}"`);
    return { isValid: true, reason: null, topic: "service description" };
  }

  // For promiseSolution, be very lenient - accept any outcome or transformation statement
  if (questionKey === 'promiseSolution') {
    const cleanedAnswer = answer.toLowerCase();
    
    // Check for promise/outcome keywords
    const hasPromiseKeywords = /\b(get|achieve|double|triple|increase|improve|generate|create|build|deliver|provide|give|help|make|earn|save|boost|grow|scale|transform|result|outcome|leads|revenue|sales|content|clients|customers|days|weeks|months|years)\b/.test(cleanedAnswer);
    
    // If it mentions any outcome or benefit, accept it
    if (hasPromiseKeywords && answer.trim().split(' ').length >= 3) {
      console.log(`[Chat API] Auto-accepting promiseSolution with promise indicators: "${answer}"`);
      return { isValid: true, reason: null, topic: "promise and transformation" };
    }
    
    // Even if no clear indicators, if it's a reasonable length, accept it
    if (answer.trim().length > 10) {
      console.log(`[Chat API] Auto-accepting promiseSolution with sufficient length: "${answer}"`);
      return { isValid: true, reason: null, topic: "promise and transformation" };
    }
  }

  // For clientResult, be much more lenient - accept any answer that mentions a result or outcome
  if (questionKey === 'clientResult') {
    const cleanedAnswer = answer.toLowerCase();
    
    // Check for result-indicating keywords (much broader list)
    const hasResultKeywords = /\b(made|increased|grew|saved|achieved|revenue|profit|sales|leads|reduction|extra|helped|generated|improved|boosted|doubled|tripled|gained|earned|won|success|result|outcome|impact|million|thousand|percent|%|dollars?|clients?|customers?)\b/.test(cleanedAnswer);
    
    // Check for numbers or quantifiable terms
    const hasQuantifiableTerms = /[0-9$€£¥%]|(?:one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|million|billion|more|less|better|faster|higher|lower)/.test(cleanedAnswer);
    
    // If it has either result keywords OR quantifiable terms, and is at least 3 words, accept it
    if ((hasResultKeywords || hasQuantifiableTerms) && answer.trim().split(' ').length >= 3) {
      console.log(`[Chat API] Auto-accepting clientResult with result indicators: "${answer}"`);
      return { isValid: true, reason: null, topic: "client success story" };
    }
    
    // Even if no clear indicators, if it's a reasonable length and mentions "client" or similar, accept it
    if (answer.trim().length > 10 && /\b(client|customer|company|business|helped|worked)\b/.test(cleanedAnswer)) {
      console.log(`[Chat API] Auto-accepting clientResult mentioning clients: "${answer}"`);
      return { isValid: true, reason: null, topic: "client success story" };
    }

    // For clientResult, if we get here and it's at least 5 words, be very lenient
    if (answer.trim().split(' ').length >= 5) {
      console.log(`[Chat API] Auto-accepting clientResult with sufficient length: "${answer}"`);
      return { isValid: true, reason: null, topic: "client success story" };
    }
  }

  // For phases, be very lenient - accept any structured list or journey description
  if (questionKey === 'phases') {
    const cleanedAnswer = answer.toLowerCase();
    
    // Check for list indicators (numbers, bullets, steps)
    const hasListStructure = /\b(1\.|2\.|3\.|4\.|5\.|step|phase|stage|first|second|third|then|next|finally|•|-)\b/.test(cleanedAnswer);
    
    // Check for journey/process keywords
    const hasJourneyKeywords = /\b(journey|process|steps|stages|phases|progression|flow|path|sequence|order|start|begin|end|finish|complete)\b/.test(cleanedAnswer);
    
    // If it has list structure OR journey keywords, and is at least 3 words, accept it
    if ((hasListStructure || hasJourneyKeywords) && answer.trim().split(' ').length >= 3) {
      console.log(`[Chat API] Auto-accepting phases with structure indicators: "${answer}"`);
      return { isValid: true, reason: null, topic: "client journey phases" };
    }
    
    // Even if no clear indicators, if it's a reasonable length, accept it
    if (answer.trim().length > 15) {
      console.log(`[Chat API] Auto-accepting phases with sufficient length: "${answer}"`);
      return { isValid: true, reason: null, topic: "client journey phases" };
    }
  }

  // For plan, be very lenient - accept any name or request for name generation
  if (questionKey === 'plan') {
    const cleanedAnswer = answer.toLowerCase();
    
    // Check for system name keywords or requests for generation
    const hasNameKeywords = /\b(framework|system|method|code|machine|blueprint|formula|model|approach|strategy|process|technique|way|name|called|title)\b/.test(cleanedAnswer);
    
    // Check for generation requests
    const requestsGeneration = /\b(generate|create|make|come up|suggest|help|yes|please|no name|don't have|need)\b/.test(cleanedAnswer);
    
    // If it mentions a name, requests generation, or is substantial, accept it
    if (hasNameKeywords || requestsGeneration || answer.trim().length > 10) {
      console.log(`[Chat API] Auto-accepting plan with name indicators: "${answer}"`);
      return { isValid: true, reason: null, topic: "system name or generation request" };
    }
  }
  
  // For uniqueMechanism, be very lenient - accept any name or request for name generation
  if (questionKey === 'uniqueMechanism') {
    const cleanedAnswer = answer.toLowerCase();
    
    // Check for system name keywords or requests for generation
    const hasNameKeywords = /\b(framework|system|method|code|machine|blueprint|formula|model|approach|strategy|process|technique|way|name|called|title)\b/.test(cleanedAnswer);
    
    // Check for generation requests
    const requestsGeneration = /\b(generate|create|make|come up|suggest|help|yes|please|no name|don't have|need)\b/.test(cleanedAnswer);
    
    // If it mentions a name, requests generation, or is substantial, accept it
    if (hasNameKeywords || requestsGeneration || answer.trim().length > 10) {
      console.log(`[Chat API] Auto-accepting uniqueMechanism with name indicators: "${answer}"`);
      return { isValid: true, reason: null, topic: "system name or generation request" };
    }
  }
  
  const validationCriteria = {
    offerType: "Accept ANY description of their business model or offer type. Be extremely lenient - N8N will handle classification.",
    offerDescription: "Accept any description of what they offer or sell, even if brief",
    targetAudience: "Accept any description of their target audience. If they reference their ideal client profile, that's perfect.",
    painPoints: "Accept any description of problems or challenges their audience faces",
    promiseSolution: "Accept ANY outcome, transformation, or promise statement. Be VERY LENIENT - any benefit or result is valid.",
    clientResult: "Accept ANY mention of helping clients or achieving results. Be extremely lenient.",
    uniqueMechanism: "Accept any name for their system/methodology OR any request for name generation (yes, please create one, etc.)",
    phases: "Accept ANY description of client transformation journey phases or emotional/business progression stages.",
    paymentTerms: "Accept any mention of price, pricing structure, or payment options",
    guaranteeScarcity: "Accept any description of guarantees, risk reversal, urgency, or scarcity elements"
  };

  const validationPrompt = [
    {
      role: "system",
      content: `You are a conversational assistant helping create a hybrid offer. Your job is to be EXTREMELY LENIENT and HELPFUL.

CRITICAL INSTRUCTIONS:
- Accept 99% of answers that are even remotely related to the question
- Only reject if the answer is completely off-topic or nonsensical
- For 'phases': ANY list, steps, or journey description is VALID (numbered lists, bullet points, stages, etc.)
- For 'uniqueMechanism': ANY method, system, or approach description is VALID
- For 'promiseSolution': ANY outcome or benefit statement is VALID
- For 'clientResult': ANY mention of helping clients or results is VALID
- If in doubt, ACCEPT the answer and move forward

EXAMPLES OF VALID ANSWERS:
- phases: "1. Research 2. Creation 3. Distribution" ✅
- phases: "Discovery, Planning, Implementation, Results" ✅  
- uniqueMechanism: "We use AI to create content" ✅
- promiseSolution: "90 days of content" ✅
- clientResult: "helped a client grow" ✅

Only mark as invalid if the answer is:
- Completely unrelated to business/offers
- Just "I don't know" or similar non-answers
- Clearly answering a different question entirely`
    },
    {
      role: "user",
      content: `Question category: ${questionKey}\nValidation criteria: ${validationCriteria[questionKey]}\nUser's answer: "${answer}"\n\nBe EXTREMELY LENIENT. Accept this answer unless it's completely off-topic or nonsensical.\nReturn JSON: { "isValid": boolean, "reason": "brief explanation if invalid", "topic": "what the answer addresses" }`
    }
  ];

  try {
    // Call OpenAI to validate the answer
    const validationCompletion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: validationPrompt,
      temperature: 0.1, // Very low temperature for consistent validation
      response_format: { type: "json_object" }
    });

    // Parse the validation result
    const validationResult = JSON.parse(validationCompletion.choices[0].message.content);
    console.log(`[Chat API] Answer validation for ${questionKey}:`, validationResult);
    return validationResult;
  } catch (error) {
    console.error('[Chat API] Error validating answer:', error);
    // Default to accepting the answer if validation fails
    return { isValid: true, reason: null };
  }
}

// Add a function to calculate questions answered
function calculateQuestionsAnswered(collectedAnswers, tool = 'hybrid-offer') {
  if (!collectedAnswers) return 0;
  
  // Get the appropriate questions array based on the tool
  let questionsArray;
  if (tool === 'workshop-generator') {
    questionsArray = workshopQuestions;
  } else if (tool === 'daily-client-machine') {
    // For DCM, get questions from the tool config
    const toolConfig = TOOLS['daily-client-machine'];
    questionsArray = toolConfig ? toolConfig.questions : [];
  } else {
    questionsArray = hybridOfferQuestions;
  }
  
  // Count how many of the predefined questions have answers
  let count = 0;
  for (const question of questionsArray) {
    if (collectedAnswers[question.key] && collectedAnswers[question.key].trim().length > 0) {
      count++;
    }
  }
  
  return count;
}


// Add a function to generate workshop HTML from template using AI
async function generateWorkshopHTML(collectedAnswers) {
  // Check if there are design modifications requested
  const hasDesignInstructions = collectedAnswers._designInstructions;
  const designTheme = collectedAnswers._designTheme;
  
  // Enhanced prompt for design modifications
  let designGuidelines = "";
  if (hasDesignInstructions) {
    designGuidelines = `\n\nSPECIAL DESIGN INSTRUCTIONS:
The user has requested the following design changes: "${collectedAnswers._designInstructions}"

Please incorporate these changes into the design. Common modifications:
- Color changes: Update CSS color schemes, gradients, and backgrounds
- Layout changes: Modify spacing, positioning, and structure
- Style changes: Adjust fonts, sizes, borders, shadows
- Theme changes: Make it more professional/modern/bold as requested
- Text changes: Update copy while maintaining conversion focus

Apply the requested changes while maintaining:
- Professional appearance
- Mobile responsiveness  
- Conversion optimization
- Accessibility standards`;
  }

  if (designTheme) {
    designGuidelines += `\n\nDESIGN THEME: ${designTheme.toUpperCase()}
- Professional: Clean, corporate colors (navy, gray, white), minimal design
- Modern: Contemporary gradients, sleek fonts, subtle animations
- Bold: Vibrant colors, strong contrasts, impactful typography`;
  }

  // Use Claude Opus to create compelling copy from the collected answers
  const copyGenerationPrompt = `You are an expert direct-response copywriter specializing in high-converting workshop landing pages. You follow the proven principles of copywriting legends like David Ogilvy, Gary Halbert, and Dan Kennedy.

Workshop Information:
- Participant Outcomes: ${collectedAnswers.participantOutcomes || 'Transform skills and achieve results'}
- Target Audience: ${collectedAnswers.targetAudience || 'professionals and entrepreneurs'}
- Problem Addressed: ${collectedAnswers.problemAddressed || 'common challenges'}
- Workshop Duration: ${collectedAnswers.workshopDuration || 'intensive workshop'}
- Topics and Activities: ${collectedAnswers.topicsAndActivities || 'proven strategies'}
- Resources Provided: ${collectedAnswers.resourcesProvided || 'comprehensive materials'}${designGuidelines}

Create compelling, conversion-focused copy for each section. Use these copywriting best practices:

HEADLINE BEST PRACTICES:
- Lead with the biggest benefit or transformation
- Use specific numbers and timeframes when possible
- Create urgency or curiosity
- Address the target audience directly
- Keep under 60 characters for main headlines

BENEFIT WRITING:
- Focus on outcomes, not features
- Use "you will" language
- Be specific and measurable
- Address pain points directly
- Create emotional connection

CTA BEST PRACTICES:
- Use action-oriented language
- Create urgency
- Remove friction
- Be specific about what happens next

Return your response as valid JSON with this exact structure:
{
  "pageTitle": "SEO-optimized page title (60 chars max)",
  "headerSubtitle": "Target audience qualifier (e.g., 'For Small Business Owners:')",
  "heroHeadline": "Compelling main headline (60 chars max)",
  "heroSubheadline": "Supporting headline with benefit/proof (100 chars max)",
  "benefitsList": ["Benefit 1", "Benefit 2", "Benefit 3", "Benefit 4", "Benefit 5"],
  "presenterName": "Workshop Expert",
  "formTitle": "Registration form title",
  "ctaHighlight": "CTA button highlight text",
  "ctaDescription": "CTA description text",
  "emailPlaceholder": "Email input placeholder",
  "ctaButtonText": "Button text",
  "formSubtitle": "Form subtitle with urgency",
  "guaranteeTitle": "Guarantee headline",
  "guaranteeText": "Guarantee description",
  "faqItems": [
    {"question": "FAQ question 1", "answer": "FAQ answer 1"},
    {"question": "FAQ question 2", "answer": "FAQ answer 2"},
    {"question": "FAQ question 3", "answer": "FAQ answer 3"}
  ],
  "footerCopyright": "Copyright text",
  "footerDisclaimer": "Disclaimer text"
}

Guidelines:
- Use James Kemp's direct, no-fluff style
- Focus on specific outcomes and transformations
- Create urgency and scarcity where appropriate
- Make every word count for conversions
- Use power words and emotional triggers
- Ensure all copy is compelling and professional
- Transform the user's input into benefit-focused, conversion copy${hasDesignInstructions ? '\n- Apply the requested design changes to the overall styling and presentation' : ''}`;

  try {
    console.log('[CHAT_API_DEBUG] Generating AI-powered workshop copy with Claude Opus');
    
    const message = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 4000,
      temperature: 0.8,
      messages: [
        {
          role: "user",
          content: copyGenerationPrompt
        }
      ]
    });

    const copyDataString = message.content[0].text;
    console.log('[CHAT_API_DEBUG] Claude Opus raw response:', copyDataString);
    
    // Extract JSON from the response (Claude might include extra text)
    let jsonMatch = copyDataString.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Claude response');
    }
    
    const copyData = JSON.parse(jsonMatch[0]);
    console.log('[CHAT_API_DEBUG] Claude-generated copy data:', copyData);

    // Determine color scheme and styling based on design instructions
    let colorScheme = {
      primary: '#667eea',
      secondary: '#764ba2',
      accent: '#ff6b6b',
      accentSecondary: '#ee5a24',
      success: '#10b981',
      successSecondary: '#059669',
      warning: '#f59e0b',
      warningSecondary: '#d97706',
      dark: '#1f2937',
      light: '#f8fafc',
      lightSecondary: '#e2e8f0'
    };

    // Apply design theme modifications
    if (designTheme === 'professional') {
      colorScheme = {
        primary: '#1e3a8a',
        secondary: '#3730a3',
        accent: '#059669',
        accentSecondary: '#047857',
        success: '#10b981',
        successSecondary: '#059669',
        warning: '#d97706',
        warningSecondary: '#b45309',
        dark: '#1f2937',
        light: '#f8fafc',
        lightSecondary: '#e2e8f0'
      };
    } else if (designTheme === 'modern') {
      colorScheme = {
        primary: '#6366f1',
        secondary: '#8b5cf6',
        accent: '#06b6d4',
        accentSecondary: '#0891b2',
        success: '#10b981',
        successSecondary: '#059669',
        warning: '#f59e0b',
        warningSecondary: '#d97706',
        dark: '#0f172a',
        light: '#f1f5f9',
        lightSecondary: '#e2e8f0'
      };
    } else if (designTheme === 'bold') {
      colorScheme = {
        primary: '#dc2626',
        secondary: '#b91c1c',
        accent: '#ea580c',
        accentSecondary: '#c2410c',
        success: '#16a34a',
        successSecondary: '#15803d',
        warning: '#ca8a04',
        warningSecondary: '#a16207',
        dark: '#1c1917',
        light: '#fafaf9',
        lightSecondary: '#f5f5f4'
      };
    }

    // Apply specific color modifications based on user instructions
    if (hasDesignInstructions) {
      const instructions = collectedAnswers._designInstructions.toLowerCase();
      
      if (instructions.includes('blue')) {
        colorScheme.primary = '#2563eb';
        colorScheme.secondary = '#1d4ed8';
      }
      if (instructions.includes('green')) {
        colorScheme.primary = '#059669';
        colorScheme.secondary = '#047857';
      }
      if (instructions.includes('purple')) {
        colorScheme.primary = '#7c3aed';
        colorScheme.secondary = '#6d28d9';
      }
      if (instructions.includes('red')) {
        colorScheme.primary = '#dc2626';
        colorScheme.secondary = '#b91c1c';
      }
      if (instructions.includes('dark')) {
        colorScheme.light = '#374151';
        colorScheme.lightSecondary = '#4b5563';
        colorScheme.dark = '#111827';
      }
    }

    // Base HTML template (Modern, Bold, Professional Style)
    const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{PAGE_TITLE}}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #1a1a1a;
            background: linear-gradient(135deg, ${colorScheme.primary} 0%, ${colorScheme.secondary} 100%);
            margin: 0;
            padding: 0;
            min-height: 100vh;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
        }
        
        /* Header */
        .header {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            padding: 20px 0;
            text-align: center;
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
            position: sticky;
            top: 0;
            z-index: 100;
        }
        
        .header-subtitle {
            color: ${colorScheme.primary};
            font-size: 1.1rem;
            font-weight: 600;
            margin-bottom: 0;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        /* Hero Section */
        .hero {
            background: linear-gradient(135deg, ${colorScheme.primary} 0%, ${colorScheme.secondary} 100%);
            padding: 80px 0;
            text-align: center;
            color: white;
            position: relative;
            overflow: hidden;
        }
        
        .hero::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="50" cy="50" r="1" fill="rgba(255,255,255,0.1)"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
            opacity: 0.3;
        }
        
        .hero-content {
            position: relative;
            z-index: 2;
        }
        
        .hero h1 {
            font-size: 3.5rem;
            font-weight: 900;
            margin-bottom: 24px;
            line-height: 1.1;
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
            max-width: 900px;
            margin-left: auto;
            margin-right: auto;
        }
        
        .hero .subheadline {
            font-size: 1.4rem;
            margin-bottom: 40px;
            font-weight: 500;
            opacity: 0.95;
            max-width: 700px;
            margin-left: auto;
            margin-right: auto;
            text-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }
        
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, ${colorScheme.accent} 0%, ${colorScheme.accentSecondary} 100%);
            color: white;
            padding: 20px 50px;
            font-size: 1.2rem;
            font-weight: 700;
            text-decoration: none;
            border-radius: 50px;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 1px;
            box-shadow: 0 10px 30px rgba(255, 107, 107, 0.4);
            border: none;
            cursor: pointer;
        }
        
        .cta-button:hover {
            transform: translateY(-3px);
            box-shadow: 0 15px 40px rgba(255, 107, 107, 0.6);
        }
        
        /* What You'll Learn Section */
        .benefits {
            padding: 80px 0;
            background: white;
            position: relative;
        }
        
        .benefits::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 100px;
            background: linear-gradient(180deg, ${colorScheme.primary} 0%, transparent 100%);
        }
        
        .benefits-content {
            position: relative;
            z-index: 2;
        }
        
        .benefits h2 {
            text-align: center;
            font-size: 2.5rem;
            font-weight: 800;
            margin-bottom: 60px;
            color: #1a1a1a;
            position: relative;
        }
        
        .benefits h2::after {
            content: '';
            position: absolute;
            bottom: -15px;
            left: 50%;
            transform: translateX(-50%);
            width: 80px;
            height: 4px;
            background: linear-gradient(135deg, ${colorScheme.accent} 0%, ${colorScheme.accentSecondary} 100%);
            border-radius: 2px;
        }
        
        .benefits-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 30px;
            max-width: 1000px;
            margin: 0 auto;
        }
        
        .benefit-item {
            background: linear-gradient(135deg, ${colorScheme.light} 0%, ${colorScheme.lightSecondary} 100%);
            padding: 30px;
            border-radius: 20px;
            border-left: 6px solid ${colorScheme.primary};
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }
        
        .benefit-item::before {
            content: '✓';
            position: absolute;
            top: 20px;
            right: 20px;
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, ${colorScheme.success} 0%, ${colorScheme.successSecondary} 100%);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 1.2rem;
        }
        
        .benefit-item:hover {
            transform: translateY(-5px);
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }
        
        .benefit-text {
            font-size: 1.1rem;
            font-weight: 500;
            color: #374151;
            line-height: 1.6;
            padding-right: 60px;
        }
        
        /* Presenter Section */
        .presenter {
            padding: 60px 0;
            background: linear-gradient(135deg, ${colorScheme.secondary} 0%, ${colorScheme.primary} 100%);
            text-align: center;
            color: white;
        }
        
        .presenter h3 {
            font-size: 2rem;
            font-weight: 700;
            margin-bottom: 20px;
            text-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        
        .presenter-subtitle {
            font-size: 1.2rem;
            opacity: 0.9;
            font-weight: 500;
        }
        
        /* Form Section */
        .form-section {
            padding: 80px 0;
            background: linear-gradient(135deg, ${colorScheme.light} 0%, ${colorScheme.lightSecondary} 100%);
            text-align: center;
            position: relative;
        }
        
        .form-section h3 {
            font-size: 2.2rem;
            font-weight: 800;
            margin-bottom: 40px;
            color: #1a1a1a;
        }
        
        .form-container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            padding: 50px;
            border-radius: 30px;
            box-shadow: 0 30px 60px rgba(0,0,0,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            position: relative;
            overflow: hidden;
        }
        
        .form-container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 6px;
            background: linear-gradient(135deg, ${colorScheme.accent} 0%, ${colorScheme.accentSecondary} 100%);
        }
        
        .price-highlight {
            background: linear-gradient(135deg, ${colorScheme.success} 0%, ${colorScheme.successSecondary} 100%);
            color: white;
            padding: 20px;
            border-radius: 15px;
            margin-bottom: 30px;
            font-size: 1.3rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            box-shadow: 0 10px 30px rgba(16, 185, 129, 0.3);
        }
        
        .form-container input {
            width: 100%;
            padding: 18px 24px;
            margin-bottom: 25px;
            border: 2px solid #e5e7eb;
            border-radius: 15px;
            font-size: 1.1rem;
            background: #f9fafb;
            color: #374151;
            transition: all 0.3s ease;
            font-weight: 500;
        }
        
        .form-container input:focus {
            outline: none;
            border-color: ${colorScheme.primary};
            background: white;
            box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
        }
        
        .form-description {
            font-size: 1.1rem;
            font-weight: 600;
            color: #374151;
            margin-bottom: 30px;
            line-height: 1.6;
        }
        
        .form-subtitle {
            font-size: 0.95rem;
            color: #6b7280;
            margin-top: 25px;
            font-weight: 500;
        }
        
        .privacy-text {
            font-size: 0.85rem;
            color: #9ca3af;
            margin-top: 20px;
            font-weight: 400;
        }
        
        /* FAQ Section */
        .faq {
            padding: 80px 0;
            background: white;
        }
        
        .faq h2 {
            text-align: center;
            font-size: 2.5rem;
            font-weight: 800;
            margin-bottom: 60px;
            color: #1a1a1a;
            position: relative;
        }
        
        .faq h2::after {
            content: '';
            position: absolute;
            bottom: -15px;
            left: 50%;
            transform: translateX(-50%);
            width: 80px;
            height: 4px;
            background: linear-gradient(135deg, ${colorScheme.primary} 0%, ${colorScheme.secondary} 100%);
            border-radius: 2px;
        }
        
        .faq-item {
            background: linear-gradient(135deg, ${colorScheme.light} 0%, ${colorScheme.lightSecondary} 100%);
            margin-bottom: 20px;
            padding: 35px;
            border-radius: 20px;
            border-left: 6px solid ${colorScheme.primary};
            max-width: 900px;
            margin-left: auto;
            margin-right: auto;
            margin-bottom: 20px;
            transition: all 0.3s ease;
        }
        
        .faq-item:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 30px rgba(0,0,0,0.1);
        }
        
        .faq-question {
            font-weight: 700;
            font-size: 1.2rem;
            margin-bottom: 15px;
            color: #1a1a1a;
        }
        
        .faq-answer {
            color: #374151;
            line-height: 1.7;
            font-size: 1.05rem;
            font-weight: 500;
        }
        
        /* Guarantee Section */
        .guarantee {
            padding: 80px 0;
            background: linear-gradient(135deg, ${colorScheme.warning} 0%, ${colorScheme.warningSecondary} 100%);
            text-align: center;
            position: relative;
        }
        
        .guarantee::before {
            content: '🛡️';
            position: absolute;
            top: 30px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 3rem;
            opacity: 0.3;
        }
        
        .guarantee-content {
            position: relative;
            z-index: 2;
        }
        
        .guarantee h3 {
            font-size: 2.2rem;
            font-weight: 800;
            margin-bottom: 25px;
            color: white;
        }
        
        .guarantee p {
            max-width: 800px;
            margin: 0 auto;
            color: white;
            line-height: 1.7;
            font-size: 1.1rem;
            font-weight: 500;
        }
        
        /* Footer */
        .footer {
            padding: 50px 0;
            background: ${colorScheme.dark};
            color: #d1d5db;
            text-align: center;
        }
        
        .footer p {
            margin-bottom: 15px;
            font-weight: 500;
        }
        
        .footer-disclaimer {
            font-size: 0.9rem;
            color: #9ca3af;
            font-weight: 400;
        }
        
        /* Mobile Responsive */
        @media (max-width: 768px) {
            .hero h1 {
                font-size: 2.5rem;
            }
            
            .hero .subheadline {
                font-size: 1.2rem;
            }
            
            .container {
                padding: 0 15px;
            }
            
            .form-container {
                margin: 0 15px;
                padding: 40px 30px;
            }
            
            .benefits-grid {
                grid-template-columns: 1fr;
                gap: 20px;
            }
            
            .benefit-item {
                padding: 25px;
            }
            
            .cta-button {
                padding: 18px 40px;
                font-size: 1.1rem;
            }
            
            .hero {
                padding: 60px 0;
            }
            
            .benefits, .form-section, .faq, .guarantee {
                padding: 60px 0;
            }
        }
        
        @media (max-width: 480px) {
            .hero h1 {
                font-size: 2rem;
            }
            
            .benefits h2, .faq h2 {
                font-size: 2rem;
            }
            
            .form-container {
                padding: 30px 20px;
            }
        }
    </style>
</head>
<body>
    <!-- Header -->
    <section class="header">
        <div class="container">
            <p class="header-subtitle">{{HEADER_SUBTITLE}}</p>
        </div>
    </section>

    <!-- Hero Section -->
    <section class="hero">
        <div class="container">
            <div class="hero-content">
                <h1>{{HERO_HEADLINE}}</h1>
                <p class="subheadline">{{HERO_SUBHEADLINE}}</p>
                <a href="#register" class="cta-button">{{CTA_BUTTON_TEXT}}</a>
            </div>
        </div>
    </section>

    <!-- Benefits Section -->
    <section class="benefits">
        <div class="container">
            <div class="benefits-content">
                <h2>What You Will Learn:</h2>
                <div class="benefits-grid">
                    {{BENEFITS_LIST}}
                </div>
            </div>
        </div>
    </section>

    <!-- Presenter Section -->
    <section class="presenter">
        <div class="container">
            <h3>Presented by {{PRESENTER_NAME}}</h3>
            <p class="presenter-subtitle">Workshop Expert & Industry Leader</p>
        </div>
    </section>

    <!-- Form Section -->
    <section class="form-section" id="register">
        <div class="container">
            <h3>{{FORM_TITLE}}</h3>
            
            <div class="form-container">
                <div class="price-highlight">
                    {{CTA_HIGHLIGHT}}
                </div>
                
                <p class="form-description">{{CTA_DESCRIPTION}}</p>
                
                <form>
                    <input type="email" placeholder="{{EMAIL_PLACEHOLDER}}" required>
                    <button type="submit" class="cta-button" style="width: 100%; margin: 0;">{{CTA_BUTTON_TEXT}}</button>
                </form>
                
                <p class="form-subtitle">{{FORM_SUBTITLE}}</p>
                <p class="privacy-text">We Respect Your Privacy & Information</p>
            </div>
        </div>
    </section>

    <!-- Guarantee Section -->
    <section class="guarantee">
        <div class="container">
            <div class="guarantee-content">
                <h3>{{GUARANTEE_TITLE}}</h3>
                <p>{{GUARANTEE_TEXT}}</p>
            </div>
        </div>
    </section>

    <!-- FAQ Section -->
    <section class="faq">
        <div class="container">
            <h2>Frequently Asked Questions</h2>
            {{FAQ_ITEMS}}
        </div>
    </section>

    <!-- Final CTA -->
    <section class="form-section">
        <div class="container">
            <h3>Ready to Transform Your Business?</h3>
            
            <div class="form-container">
                <div class="price-highlight">
                    {{CTA_HIGHLIGHT}}
                </div>
                
                <p class="form-description">{{CTA_DESCRIPTION}}</p>
                
                <form>
                    <input type="email" placeholder="{{EMAIL_PLACEHOLDER}}" required>
                    <button type="submit" class="cta-button" style="width: 100%; margin: 0;">{{CTA_BUTTON_TEXT}}</button>
                </form>
                
                <p class="form-subtitle">{{FORM_SUBTITLE}}</p>
                <p class="privacy-text">We Respect Your Privacy & Information</p>
            </div>
        </div>
    </section>

    <!-- Footer -->
    <footer class="footer">
        <div class="container">
            <p>{{FOOTER_COPYRIGHT}}</p>
            <p class="footer-disclaimer">{{FOOTER_DISCLAIMER}}</p>
        </div>
    </footer>
</body>
</html>`;

    // Generate benefits list HTML for the new grid layout
    const benefitsList = copyData.benefitsList.map(benefit => 
      `<div class="benefit-item">
        <div class="benefit-text">${benefit}</div>
      </div>`
    ).join('\n                    ');
    
    // Generate FAQ items HTML
    const faqItems = copyData.faqItems.map(faq => `
            <div class="faq-item">
                <div class="faq-question">${faq.question}</div>
                <div class="faq-answer">${faq.answer}</div>
            </div>`).join('\n');

    // Replace all placeholders with Claude-generated content
    let populatedHTML = htmlTemplate
      .replace(/{{PAGE_TITLE}}/g, copyData.pageTitle)
      .replace(/{{HEADER_SUBTITLE}}/g, copyData.headerSubtitle)
      .replace(/{{HERO_HEADLINE}}/g, copyData.heroHeadline)
      .replace(/{{HERO_SUBHEADLINE}}/g, copyData.heroSubheadline)
      .replace(/{{BENEFITS_LIST}}/g, benefitsList)
      .replace(/{{PRESENTER_NAME}}/g, copyData.presenterName)
      .replace(/{{FORM_TITLE}}/g, copyData.formTitle)
      .replace(/{{CTA_HIGHLIGHT}}/g, copyData.ctaHighlight)
      .replace(/{{CTA_DESCRIPTION}}/g, copyData.ctaDescription)
      .replace(/{{EMAIL_PLACEHOLDER}}/g, copyData.emailPlaceholder)
      .replace(/{{CTA_BUTTON_TEXT}}/g, copyData.ctaButtonText)
      .replace(/{{FORM_SUBTITLE}}/g, copyData.formSubtitle)
      .replace(/{{GUARANTEE_TITLE}}/g, copyData.guaranteeTitle)
      .replace(/{{GUARANTEE_TEXT}}/g, copyData.guaranteeText)
      .replace(/{{FAQ_ITEMS}}/g, faqItems)
      .replace(/{{FOOTER_COPYRIGHT}}/g, copyData.footerCopyright)
      .replace(/{{FOOTER_DISCLAIMER}}/g, copyData.footerDisclaimer);

    console.log('[CHAT_API_DEBUG] HTML template populated with Claude-generated copy');
    return populatedHTML;

  } catch (error) {
    console.error('[CHAT_API_DEBUG] Error generating Claude copy for workshop HTML:', error);
    
    // Fallback to basic template if Claude generation fails
    const fallbackHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Workshop Registration</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f8f9fa; margin: 0; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; }
        h1 { color: #333; text-align: center; margin-bottom: 30px; }
        .cta-button { display: inline-block; background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Workshop Registration</h1>
        <p>Join our upcoming workshop and transform your skills!</p>
        <p><strong>What you'll learn:</strong> ${collectedAnswers.topicsAndActivities || 'Valuable skills and strategies'}</p>
        <p><strong>Duration:</strong> ${collectedAnswers.workshopDuration || 'Full workshop experience'}</p>
        <p><strong>Resources:</strong> ${collectedAnswers.resourcesProvided || 'Comprehensive materials'}</p>
        <div style="text-align: center; margin-top: 30px;">
            <a href="#register" class="cta-button">Register Now</a>
        </div>
    </div>
</body>
</html>`;
    
    return fallbackHTML;
  }
}

export async function POST(request) {
  try {
    // Get the request body
    const body = await request.json();
    const { messages, tool, isToolInit, chatId: clientChatId, isDocumentResult } = body;
    
    let currentQuestionKey = body.currentQuestionKey || null; 
    const collectedAnswers = body.collectedAnswers || {};
    
    let chatId = clientChatId;
    if (!chatId || !isValidUUID(chatId)) {
      chatId = uuidv4();
      console.log(`[CHAT_API_DEBUG] ChatId validation failed: received="${clientChatId}", generated new UUID="${chatId}"`);
    } else {
      console.log(`[CHAT_API_DEBUG] ChatId validation passed: using existing UUID="${chatId}"`);
    }

    console.log('[CHAT_API_DEBUG] Request received:', { 
      messageCount: messages?.length || 0, 
      toolId: tool || 'none',
      isToolInit: isToolInit || false,
      chatId: chatId
    });

    if (!isToolInit && (!messages || !Array.isArray(messages) || messages.length === 0)) {
      return NextResponse.json(
        { error: 'Messages array cannot be empty for non-initialization calls' },
        { status: 400 }
      );
    }

    // Initialize Supabase client early, before any operations that might use it
    const supabase = createServerClientWithCookies();

    // Get the authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    let userId = user?.id;

    // Handle anonymous users more gracefully
    if (!userId) {
      if (process.env.ALLOW_ANONYMOUS_CHATS === 'true') {
        // Generate a consistent anonymous ID based on the chat ID for better tracking
        userId = 'anon-' + (chatId.substring(0, 8));
        console.log('[CHAT_API_DEBUG] Anonymous chat allowed, using temporary user ID:', userId);
      } else {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
    }

    // Handle ideal-client-extractor tool initialization with profile context
    if (isToolInit && tool === 'ideal-client-extractor') {
      // Build profile context for this tool
      let userProfile = null;
      if (userId && !userId.startsWith('anon-')) {
        try {
          const { data: profileData, error: profileError } = await supabase
            .from('user_profiles')
            .select('full_name, occupation, desired_mrr, desired_hours')
            .eq('user_id', userId)
            .single();
          if (!profileError) {
            userProfile = profileData;
          }
        } catch (profileException) {
          // Continue without profile if there's an error
        }
      }

      const toolConfig = TOOLS[tool];
      
      // Create initial message
      const initialMessage = `I'll interview you to get the juicy details about your client persona(s)...then I'll give you an ideal client profile you can use in your copywriting.\n\nStarting high level...\n\n**Who is your ideal customer?** Describe their demographics, current situation, and main challenges.\n\nFor example:\n• "Small business owners with 5-20 employees struggling to scale"\n• "Working moms in their 30s-40s overwhelmed juggling career and family"\n• "Tech startup founders who've raised Series A but can't find product-market fit"`;
      
      const finalChatIdForDB = isValidUUID(clientChatId) ? clientChatId : chatId;

      const initialMetadataForDB = {
        currentQuestionKey: null, // No predefined questions for this tool
        questionsAnswered: 0,
        isComplete: false,
        collectedAnswers: {}
      };

      const initResponsePayload = {
        message: initialMessage,
        currentQuestionKey: initialMetadataForDB.currentQuestionKey,
        collectedAnswers: { ...initialMetadataForDB.collectedAnswers },
        questionsAnswered: initialMetadataForDB.questionsAnswered,
        isComplete: initialMetadataForDB.isComplete,
        chatId: finalChatIdForDB,
        systemPrompt: toolConfig.systemMessage
      };

      // Save thread to database
      try {
        console.log(`[CHAT_API_DEBUG] Attempting to save new ideal-client-extractor thread for tool init. Chat ID: ${finalChatIdForDB}`);
        const { data: existingThread, error: lookupError } = await supabase
          .from('threads')
          .select('id')
          .eq('id', finalChatIdForDB)
          .single();

        if (lookupError && lookupError.code === 'PGRST116') {
          const threadTitle = toolConfig.name;
          
          const { error: insertError } = await supabase
            .from('threads')
            .insert({
              id: finalChatIdForDB,
              user_id: userId,
              tool_id: tool,
              title: threadTitle,
              metadata: initialMetadataForDB
            });

          if (insertError) {
            console.error('[CHAT_API_DEBUG] Error inserting new ideal-client-extractor thread during tool init:', insertError);
          } else {
            console.log('[CHAT_API_DEBUG] New ideal-client-extractor thread saved successfully during tool init:', finalChatIdForDB);
          }
        } else if (existingThread) {
          console.log('[CHAT_API_DEBUG] Ideal-client-extractor thread already existed during tool init, not re-inserting:', finalChatIdForDB);
        } else if (lookupError) {
          console.error('[CHAT_API_DEBUG] Error looking up ideal-client-extractor thread during tool init:', lookupError);
        }
      } catch (dbSaveError) {
        console.error('[CHAT_API_DEBUG] DB exception during ideal-client-extractor tool init thread save:', dbSaveError);
      }

      console.log('[CHAT_API_DEBUG] Sending initial ideal-client-extractor response (tool init)');
      return NextResponse.json(initResponsePayload);
    }
    
    if (isToolInit && tool === 'workshop-generator') {
      const initialSystemPrompt = `You are creating a workshop for coaches, consultants, and trainers.`;
      const initialMessage = "Welcome! I'm excited to help you create a compelling workshop. Let's start with the most important part - what specific outcomes or goals will participants achieve by the end of your workshop?";
      const existingAnswers = body.collectedAnswers || {};
      
      const finalChatIdForDB = isValidUUID(clientChatId) ? clientChatId : chatId;

      const initialMetadataForDB = {
        currentQuestionKey: 'participantOutcomes',
        questionsAnswered: 0,
        isComplete: false,
        collectedAnswers: {}
      };

      const initResponsePayload = {
        message: initialMessage,
        currentQuestionKey: initialMetadataForDB.currentQuestionKey,
        collectedAnswers: { ...initialMetadataForDB.collectedAnswers },
        questionsAnswered: initialMetadataForDB.questionsAnswered,
        isComplete: initialMetadataForDB.isComplete,
        chatId: finalChatIdForDB,
        systemPrompt: initialSystemPrompt
      };

      // Save thread to database
      try {
        console.log(`[CHAT_API_DEBUG] Attempting to save new workshop thread for tool init. Chat ID: ${finalChatIdForDB}`);
        const { data: existingThread, error: lookupError } = await supabase
          .from('threads')
          .select('id')
          .eq('id', finalChatIdForDB)
          .single();

        if (lookupError && lookupError.code === 'PGRST116') {
          const toolDetails = TOOLS[tool];
          const threadTitle = toolDetails ? toolDetails.name : 'Workshop Generator';
          
          const { error: insertError } = await supabase
            .from('threads')
            .insert({
              id: finalChatIdForDB,
              user_id: userId,
              tool_id: tool,
              title: threadTitle,
              metadata: initialMetadataForDB
            });

          if (insertError) {
            console.error('[CHAT_API_DEBUG] Error inserting new workshop thread during tool init:', insertError);
          } else {
            console.log('[CHAT_API_DEBUG] New workshop thread saved successfully during tool init:', finalChatIdForDB);
          }
        } else if (existingThread) {
          console.log('[CHAT_API_DEBUG] Workshop thread already existed during tool init, not re-inserting:', finalChatIdForDB);
        } else if (lookupError) {
          console.error('[CHAT_API_DEBUG] Error looking up workshop thread during tool init:', lookupError);
        }
      } catch (dbSaveError) {
        console.error('[CHAT_API_DEBUG] DB exception during workshop tool init thread save:', dbSaveError);
      }

      console.log('[CHAT_API_DEBUG] Sending initial workshop generator response (tool init)');
      return NextResponse.json(initResponsePayload);
    }

    // Handle daily-client-machine tool initialization
    if (isToolInit && tool === 'daily-client-machine') {
      const toolConfig = TOOLS[tool];
      
      // Create initial message for DCM
      const initialMessage = `Welcome to the Daily Client Machine Builder! I'm here to help you create a powerful client acquisition system that works 24/7.

How can I best support you today?

1. **🚀 Build from Scratch** - Create a new Daily Client Machine step-by-step
2. **🛠️ Tech Support** - Help with GoHighLevel setup, page building, or cloning templates
3. **✍️ Copywriting Help** - Improve your headlines, sales copy, or email sequences
4. **🎯 Strategy Session** - Discuss your overall DCM strategy, lead magnets, or offer structure
5. **🔍 Review & Optimize** - Analyze your existing funnel for improvements

Just type the number or describe what you need help with.`;
      
      const finalChatIdForDB = isValidUUID(clientChatId) ? clientChatId : chatId;

      const initialMetadataForDB = {
        currentQuestionKey: 'bigIdea',
        questionsAnswered: 0,
        isComplete: false,
        collectedAnswers: {},
        currentPageId: 'foundation',
        foundationShown: false
      };

      const initResponsePayload = {
        message: initialMessage,
        currentQuestionKey: initialMetadataForDB.currentQuestionKey,
        collectedAnswers: { ...initialMetadataForDB.collectedAnswers },
        questionsAnswered: initialMetadataForDB.questionsAnswered,
        isComplete: initialMetadataForDB.isComplete,
        chatId: finalChatIdForDB,
        currentPageId: 'foundation',
        currentPageIndex: 0,
        totalPages: toolConfig.pages.length,
        systemPrompt: toolConfig.systemMessage
      };

      // Save thread to database
      try {
        console.log(`[CHAT_API_DEBUG] Attempting to save new daily-client-machine thread for tool init. Chat ID: ${finalChatIdForDB}`);
        const { data: existingThread, error: lookupError } = await supabase
          .from('threads')
          .select('id')
          .eq('id', finalChatIdForDB)
          .single();

        if (lookupError && lookupError.code === 'PGRST116') {
          const threadTitle = toolConfig.name;
          
          const { error: insertError } = await supabase
            .from('threads')
            .insert({
              id: finalChatIdForDB,
              user_id: userId,
              tool_id: tool,
              title: threadTitle,
              metadata: initialMetadataForDB
            });

          if (insertError) {
            console.error('[CHAT_API_DEBUG] Error inserting new daily-client-machine thread during tool init:', insertError);
          } else {
            console.log('[CHAT_API_DEBUG] New daily-client-machine thread saved successfully during tool init:', finalChatIdForDB);
          }
        } else if (existingThread) {
          console.log('[CHAT_API_DEBUG] Daily-client-machine thread already existed during tool init, not re-inserting:', finalChatIdForDB);
        } else if (lookupError) {
          console.error('[CHAT_API_DEBUG] Error looking up daily-client-machine thread during tool init:', lookupError);
        }
      } catch (dbSaveError) {
        console.error('[CHAT_API_DEBUG] DB exception during daily-client-machine tool init thread save:', dbSaveError);
      }

      // Save the welcome message to the database
      try {
        console.log('[CHAT_API_DEBUG] Saving DCM welcome message to database');
        const { error: messageError } = await supabase
          .from('messages')
          .insert({
            thread_id: finalChatIdForDB,
            content: initialMessage,
            role: 'assistant',
            user_id: userId
          });

        if (messageError) {
          console.error('[CHAT_API_DEBUG] Error saving DCM welcome message:', messageError);
        } else {
          console.log('[CHAT_API_DEBUG] DCM welcome message saved successfully');
        }
      } catch (messageException) {
        console.error('[CHAT_API_DEBUG] Exception saving DCM welcome message:', messageException);
      }

      console.log('[CHAT_API_DEBUG] Sending initial daily-client-machine response (tool init)');
      return NextResponse.json(initResponsePayload);
    }

    // Handle invalid tool IDs for initialization
    if (isToolInit && tool && !TOOLS[tool]) {
      console.error(`[CHAT_API_DEBUG] Tool initialization attempted for invalid tool: ${tool}`);
      return NextResponse.json(
        { error: `Invalid tool: ${tool}. Available tools: ${Object.keys(TOOLS).join(', ')}` },
        { status: 400 }
      );
    }

    // NOW build profile context only for non-workshop-init requests (where we actually need it)
    console.log('[CHAT_API_DEBUG] Building profile context for non-init request');
    
    // Fetch profile information for authenticated users
    let userProfile = null;
    if (userId && !userId.startsWith('anon-')) {
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('full_name, occupation, desired_mrr, desired_hours, ideal_client_profile')
          .eq('user_id', userId)
          .single();
        if (!profileError) {
          userProfile = profileData;
        } else if (process.env.NODE_ENV !== 'production') {
          console.error('[CHAT_API_DEBUG] Error fetching user profile:', profileError);
        }
      } catch (profileException) {
        if (process.env.NODE_ENV !== 'production') console.error('[CHAT_API_DEBUG] Exception fetching profile:', profileException);
      }
    }

    // Build profile context using the centralized function from ai.js
    const profileContext = await buildProfileContext(userProfile);

    // Handle anonymous users more gracefully
    if (!userId) {
      if (process.env.ALLOW_ANONYMOUS_CHATS === 'true') {
        // Generate a consistent anonymous ID based on the chat ID for better tracking
        userId = 'anon-' + (chatId.substring(0, 8));
        console.log('[CHAT_API_DEBUG] Anonymous chat allowed, using temporary user ID:', userId);
      } else {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
    }

    // SECTION 1: Handle tool initialization (especially for hybrid-offer)
    if (isToolInit && tool === 'hybrid-offer') {
      const initialSystemPrompt = `You are creating a hybrid offer for businesses. (concise prompt details...)${profileContext}`;
      const firstQuestion = hybridOfferQuestions.find(q => q.key === 'offerType');
      
      // Check if user has psychographic brief and use context-aware question if available
      let initialMessage = firstQuestion ? firstQuestion.question : "What type of offer are you creating?";
              if (userProfile?.ideal_client_profile && firstQuestion?.contextAwareQuestion) {
        initialMessage = firstQuestion.contextAwareQuestion;
      }
      
      const existingAnswers = body.collectedAnswers || {};
      const questionsAnsweredOnInit = calculateQuestionsAnswered(existingAnswers);
      
      // Note: chatId here is the one from the client, which might be temporary.
      // The API will generate a permanent UUID if clientChatId was not a valid UUID.
      // We need to use the *final* chatId (permanent UUID) for DB operations.
      const finalChatIdForDB = isValidUUID(clientChatId) ? clientChatId : chatId; // chatId is already the potentially new UUID

      const initialMetadataForDB = {
                  currentQuestionKey: 'offerType',
        questionsAnswered: 0,
        isComplete: false,
        // collectedAnswers should be empty at init, but let's ensure it is for metadata
        collectedAnswers: {}
      };

      const initResponsePayload = {
        message: initialMessage,
        currentQuestionKey: initialMetadataForDB.currentQuestionKey,
        collectedAnswers: { ...initialMetadataForDB.collectedAnswers }, // Send empty for client to start fresh
        questionsAnswered: initialMetadataForDB.questionsAnswered,
        isComplete: initialMetadataForDB.isComplete,
        chatId: finalChatIdForDB, // Send the permanent UUID back to the client
        systemPrompt: initialSystemPrompt
      };

      // Attempt to save this new thread with its initial metadata to the database
      try {
        console.log(`[CHAT_API_DEBUG] Attempting to save new thread for tool init. Chat ID: ${finalChatIdForDB}`);
        const { data: existingThread, error: lookupError } = await supabase
          .from('threads')
          .select('id')
          .eq('id', finalChatIdForDB)
          .single();

        if (lookupError && lookupError.code === 'PGRST116') { // Not found, so insert
          const toolDetails = TOOLS[tool];
          const threadTitle = toolDetails ? toolDetails.name : 'Hybrid Offer Chat'; // Default title
          
          const { error: insertError } = await supabase
            .from('threads')
            .insert({
              id: finalChatIdForDB,
              user_id: userId, // Ensure userId is available here
              tool_id: tool,
              title: threadTitle,
              metadata: initialMetadataForDB
            });

          if (insertError) {
            console.error('[CHAT_API_DEBUG] Error inserting new thread during tool init:', insertError);
            // Don't fail the whole request, but log the error. Client will have initial state.
          } else {
            console.log('[CHAT_API_DEBUG] New thread saved successfully during tool init:', finalChatIdForDB);
          }
        } else if (existingThread) {
          // Thread already exists, maybe update its metadata if it was a re-init attempt?
          // For now, let's assume init is for a new session. If it exists, metadata should already be there.
          console.log('[CHAT_API_DEBUG] Thread already existed during tool init, not re-inserting:', finalChatIdForDB);
        } else if (lookupError) {
          console.error('[CHAT_API_DEBUG] Error looking up thread during tool init:', lookupError);
        }
      } catch (dbSaveError) {
        console.error('[CHAT_API_DEBUG] DB exception during tool init thread save:', dbSaveError);
      }

      console.log('[CHAT_API_DEBUG] Sending initial hybrid offer response (tool init)');
      return NextResponse.json(initResponsePayload);
    }

    // SECTION 1B: Handle workshop generator tool initialization
    if (isToolInit && tool === 'workshop-generator') {
      const initialSystemPrompt = `You are creating a workshop for coaches, consultants, and trainers.${profileContext}`;
      const initialMessage = "Welcome! I'm excited to help you create a compelling workshop. Let's start with the most important part - what specific outcomes or goals will participants achieve by the end of your workshop?";
      const existingAnswers = body.collectedAnswers || {};
      
      const finalChatIdForDB = isValidUUID(clientChatId) ? clientChatId : chatId;

      const initialMetadataForDB = {
        currentQuestionKey: 'participantOutcomes',
        questionsAnswered: 0,
        isComplete: false,
        collectedAnswers: {}
      };

      const initResponsePayload = {
        message: initialMessage,
        currentQuestionKey: initialMetadataForDB.currentQuestionKey,
        collectedAnswers: { ...initialMetadataForDB.collectedAnswers },
        questionsAnswered: initialMetadataForDB.questionsAnswered,
        isComplete: initialMetadataForDB.isComplete,
        chatId: finalChatIdForDB,
        systemPrompt: initialSystemPrompt
      };

      // Save thread to database
      try {
        console.log(`[CHAT_API_DEBUG] Attempting to save new workshop thread for tool init. Chat ID: ${finalChatIdForDB}`);
        const { data: existingThread, error: lookupError } = await supabase
          .from('threads')
          .select('id')
          .eq('id', finalChatIdForDB)
          .single();

        if (lookupError && lookupError.code === 'PGRST116') {
          const toolDetails = TOOLS[tool];
          const threadTitle = toolDetails ? toolDetails.name : 'Workshop Generator';
          
          const { error: insertError } = await supabase
            .from('threads')
            .insert({
              id: finalChatIdForDB,
              user_id: userId,
              tool_id: tool,
              title: threadTitle,
              metadata: initialMetadataForDB
            });

          if (insertError) {
            console.error('[CHAT_API_DEBUG] Error inserting new workshop thread during tool init:', insertError);
          } else {
            console.log('[CHAT_API_DEBUG] New workshop thread saved successfully during tool init:', finalChatIdForDB);
          }
        } else if (existingThread) {
          console.log('[CHAT_API_DEBUG] Workshop thread already existed during tool init, not re-inserting:', finalChatIdForDB);
        } else if (lookupError) {
          console.error('[CHAT_API_DEBUG] Error looking up workshop thread during tool init:', lookupError);
        }
      } catch (dbSaveError) {
        console.error('[CHAT_API_DEBUG] DB exception during workshop tool init thread save:', dbSaveError);
      }

      console.log('[CHAT_API_DEBUG] Sending initial workshop generator response (tool init)');
      return NextResponse.json(initResponsePayload);
    }

    // Handle invalid tool IDs
    if (isToolInit && tool && !TOOLS[tool]) {
      console.error(`[CHAT_API_DEBUG] Tool initialization attempted for invalid tool: ${tool}`);
      return NextResponse.json(
        { error: `Invalid tool: ${tool}. Available tools: ${Object.keys(TOOLS).join(', ')}` },
        { status: 400 }
      );
    }

    // Save incoming USER message to DB & ensure thread exists
    if (chatId && messages && messages.length > 0) {
      try {
        // First, check if thread exists
        let { data: existingThread, error: lookupError } = await supabase
          .from('threads')
          .select('id, title, user_id, tool_id, metadata')
          .eq('id', chatId)
          .single();
        
        if (lookupError && lookupError.code === 'PGRST116') {
          // Thread not found, create new one
          console.log(`[CHAT_API_DEBUG] Thread not found, creating new: ${chatId}`);
          
          const firstUserMessage = messages.find(msg => msg.role === 'user');
          const threadTitle = firstUserMessage 
            ? generateThreadTitle(firstUserMessage) 
            : (tool ? TOOLS[tool]?.name || 'Tool Chat' : 'New conversation');
          
          const initialMetadata = tool === 'hybrid-offer' 
            ? { currentQuestionKey: 'offerType', questionsAnswered: 0, isComplete: false } 
            : {};
          
          console.log(`[CHAT_API_DEBUG] Creating thread with data:`, {
            id: chatId,
            title: threadTitle,
            user_id: userId,
            tool_id: tool || null,
            metadata: initialMetadata
          });
          
          const { data: newThread, error: threadError } = await supabase
            .from('threads')
            .insert({
              id: chatId,
              title: threadTitle,
              user_id: userId,
              tool_id: tool || null,
              metadata: initialMetadata
            })
            .select()
            .single();
          
          if (threadError) {
            console.error('[CHAT_API_DEBUG] Error creating thread:', threadError);
            console.error('[CHAT_API_DEBUG] Thread creation failed with details:', {
              code: threadError.code,
              message: threadError.message,
              details: threadError.details,
              hint: threadError.hint
            });
          } else {
            console.log('[CHAT_API_DEBUG] Thread created successfully:', newThread.id);
            existingThread = newThread;
          }
        } else if (lookupError) {
          console.error('[CHAT_API_DEBUG] Unexpected error looking up thread:', lookupError);
        } else {
          console.log('[CHAT_API_DEBUG] Thread found:', existingThread?.id);
        }

        // Save the user message if thread exists or was created successfully
        if (existingThread) {
          const lastMessage = messages[messages.length - 1];
          if (lastMessage && lastMessage.content && lastMessage.role === 'user') {
            // Check if this exact message already exists to avoid duplicates
            const { data: existingUserMsg, error: msgCheckError } = await supabase
              .from('messages')
              .select('id')
              .eq('thread_id', chatId)
              .eq('content', lastMessage.content)
              .eq('role', 'user')
              .limit(1);
            
            if (msgCheckError) {
              console.error('[CHAT_API_DEBUG] Error checking existing user message:', msgCheckError);
            }
            
            if (!existingUserMsg || existingUserMsg.length === 0) {
              const { error: saveMsgError } = await supabase
                .from('messages')
                .insert({
                  thread_id: chatId,
                  role: lastMessage.role,
                  content: lastMessage.content,
                  timestamp: lastMessage.timestamp || new Date().toISOString(),
                  user_id: userId
                });
              
              if (saveMsgError) {
                console.error('[CHAT_API_DEBUG] Error saving user message:', saveMsgError);
              } else {
                console.log('[CHAT_API_DEBUG] User message saved.');
              }
            } else {
              console.log('[CHAT_API_DEBUG] User message already exists, skipping save.');
            }
          }
        } else {
          console.error('[CHAT_API_DEBUG] Cannot save message - thread does not exist and creation failed');
        }
      } catch (dbError) {
        console.error('[CHAT_API_DEBUG] DB error (user message/thread):', dbError);
      }
    }

    // Handle document result messages (special case)
    if (isDocumentResult && messages && messages.length > 0) {
      const documentMessage = messages[messages.length - 1];
      if (documentMessage && documentMessage.role === 'assistant') {
        console.log('[CHAT_API_DEBUG] Processing document result message');
        
        // Save the document message directly and return
        if (chatId && supabase) {
          try {
            const msgObj = { 
              thread_id: chatId, 
              role: 'assistant', 
              content: documentMessage.content, 
              timestamp: new Date().toISOString(), 
              user_id: userId 
            };
            
            const { data: savedMsg, error: saveError } = await supabase
              .from('messages')
              .insert(msgObj)
              .select()
              .single();
              
            if (saveError) {
              console.error('[CHAT_API_DEBUG] Error saving document result message:', saveError);
            } else {
              console.log('[CHAT_API_DEBUG] Document result message saved:', { id: savedMsg?.id });
            }
          } catch (dbError) {
            console.error('[CHAT_API_DEBUG] DB error saving document result message:', dbError);
          }
        }
        
        // Return success response
        return NextResponse.json({
          message: documentMessage.content,
          chatId: chatId,
          isDocumentResult: true
        });
      }
    }

    // SECTION 2: Determine AI's response content and tool-specific state
    let determinedAiResponseContent;
    let toolResponsePayload = null;

    if (tool === 'hybrid-offer') {
      console.log('[CHAT_API_DEBUG] Processing hybrid-offer tool logic (non-init path)');
      currentQuestionKey = body.currentQuestionKey || 'offerType';
      const currentQuestionsAnswered = calculateQuestionsAnswered(collectedAnswers, tool);
      const totalQuestions = hybridOfferQuestions.length;

      // Prepare chat history for the prompt
      const recentHistoryMessages = messages.slice(-5);
      let chatHistoryString = "No recent history available.";
      if (recentHistoryMessages.length > 0) {
        chatHistoryString = recentHistoryMessages.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n');
      }
      const latestUserMessageContent = messages.length > 0 ? messages[messages.length - 1].content : "";
      const currentQuestionDetails = hybridOfferQuestions.find(q => q.key === currentQuestionKey);
      const currentQuestionDescription = currentQuestionDetails?.description || 'the current topic';
      
      // Use context-aware question if user has psychographic brief
      let currentQuestionText = currentQuestionDetails?.question || 'this aspect of your offer';
              if (userProfile?.ideal_client_profile && currentQuestionDetails?.contextAwareQuestion) {
        currentQuestionText = currentQuestionDetails.contextAwareQuestion;
      }

      let promptParts = [];
      promptParts.push("You are a friendly and cheeky helpful AI assistant guiding a user through creating a 'hybrid offer'. Your goal is to gather specific pieces of information by asking questions in a conversational manner.");
      promptParts.push("Your tone should be friendly, funny when appropriate, conversational, and engaging. Adapt your language based on the user's style in the chat history.");

      promptParts.push(`\nInformation collected so far for the hybrid offer (${currentQuestionsAnswered}/${totalQuestions} questions answered):`);
      promptParts.push(`IMPORTANT: Questions must be asked in this exact order. Do NOT skip questions.`);
      hybridOfferQuestions.forEach((q, index) => {
        if (collectedAnswers[q.key]) {
          promptParts.push(`✓ ${index + 1}. ${q.key} (${q.description}): Answered`); // Don't show the answer itself to keep prompt shorter
        } else {
          promptParts.push(`◯ ${index + 1}. ${q.key} (${q.description}): Not yet discussed`);
        }
      });

      promptParts.push(`\nWe are currently focusing on: '${currentQuestionDescription}' (Key: ${currentQuestionKey}). The guiding question for this topic is: "${currentQuestionText}"`);

      // Add explicit debugging for the AI
      promptParts.push(`\nCURRENT STATE DEBUG:`);
      promptParts.push(`- Current question: ${currentQuestionKey}`);
      promptParts.push(`- Questions answered so far: ${Object.keys(collectedAnswers).join(', ')}`);
      promptParts.push(`- Total questions answered: ${currentQuestionsAnswered}/${totalQuestions}`);
      promptParts.push(`- Next question should be the first unanswered question in this order: ${hybridOfferQuestions.map(q => q.key).join(' → ')}`);

      promptParts.push(`\nRecent Conversation History (last 5 messages):`);
      promptParts.push(chatHistoryString);

      promptParts.push(`\n---`);
      promptParts.push(`Your Tasks based on the User's LATEST message ("${latestUserMessageContent}"):`);
      promptParts.push(`1. validAnswer (boolean): Is the user's latest message a relevant and sufficient answer for '${currentQuestionDescription}'? Apply reasonable judgment based on the specific question context.`);
      
      // Update the validation criteria to be more balanced
      promptParts.push(`   IMPORTANT - Balanced Validation Criteria: When evaluating if an answer is valid (validAnswer=true):
         * The answer MUST be relevant to the current question topic - for example, pricing information is not a valid answer to a question about solution approach
         * The answer should address the core of what's being asked, not tangential information
         * Pay special attention to question/answer mismatch - if the currentQuestionKey is "solution" but the user is discussing pricing or audience, the answer is NOT valid
         * Consider the context of previous exchanges - if the user has provided details across multiple messages, consider the cumulative information
         * If the user asks a question instead of answering, this is NOT a valid answer
         * If the user's response is completely off-topic or discusses a different aspect of their business than what was asked, mark as invalid and redirect them
         * For 'clientResult', if the user provides a clear, quantifiable outcome (e.g., 'Made a client $1M extra', 'Increased sales by 50%'), this IS a SUFFICIENT initial answer. You can acknowledge this and then decide if it's the *final* question or if you need to move to a summary/completion step. You might optionally ask for *how* they achieved it if the conversation feels incomplete, but the quantifiable result itself is valid.
         * For each question type, insufficient answers might look like:
            - solution question: "I charge 13% upside" (this is pricing, not solution)
            - painPoints question: "My target audience is small businesses" (this is audience, not pain points)
            - targetAudience question: "I solve their problems with my amazing service" (this is solution, not audience)
         * For each question type, these are examples of SUFFICIENT answers:
            - offerDescription: "Google Ads management service" or "Social media content creation for small businesses"
            - targetAudience: "Small business owners who don't have time for marketing" OR if user has ideal client profile: "same as my ideal client profile", "same as my profile", "see my profile"
            - painPoints: "They struggle to get consistent leads and don't know how to optimize ad spend"
            - solution: "We handle campaign creation, keyword research, and ongoing optimization"
            - pricing: "Monthly retainer of $1000" or "15% of ad spend"
            - clientResult: "Increased a client's sales by 30% in the first quarter." or "Helped a SaaS company make an extra $1M last year." // No need to initially force the 'how' here.
         * When an answer is invalid because it's addressing the wrong topic:
            1. Clearly but kindly explain that they're discussing a different aspect than what was asked
            2. Acknowledge what they shared (e.g., "Thanks for sharing about your pricing structure")
            3. Redirect them to the current question with a more specific prompt
            4. If needed, explain why understanding this particular aspect is important
         * If they've attempted to answer the question but provided insufficient details, probe deeper with specific follow-up questions
         * When in doubt, use follow-up questions rather than automatically moving to the next question`);
      
      promptParts.push(`2. savedAnswer (string): If validAnswer is true, extract or summarize the core information provided by the user for '${currentQuestionDescription}'. This will be saved. For 'clientResult', ensure it's a specific past achievement, not a general promise. If validAnswer is false, this can be an empty string or null.`);
      promptParts.push(`3. isComplete (boolean): After considering the user's latest answer, are all ${totalQuestions} hybrid offer questions now answered (i.e., validAnswer was true for the *final* question, or all questions already had answers)?`);
      promptParts.push(`4. nextQuestionKey (string):`);
      promptParts.push(`   - If validAnswer is true AND isComplete is false: Determine the *key* of the *next* question in the proper sequence from this ordered list: ${hybridOfferQuestions.map(q => q.key).join(", ")}. IMPORTANT: Follow the questions in this exact order - find the next question in the sequence that hasn't been answered yet. Do NOT skip questions.`);
      promptParts.push(`   - CRITICAL: The order is: 1. offerType, 2. offerDescription, 3. targetAudience, 4. painPoints, 5. promiseSolution, 6. clientResult, 7. plan, 8. phases, 9. paymentTerms, 10. guaranteeScarcity`);
      promptParts.push(`   - If offerType is answered but offerDescription is not, the nextQuestionKey MUST be "offerDescription"`);
      promptParts.push(`   - If validAnswer is false: This should be the *current* currentQuestionKey (${currentQuestionKey}), as we need to re-ask or clarify.`);
      promptParts.push(`   - If isComplete is true: This can be null.`);
      
      // Provide context-aware questions for the AI to use
      if (userProfile?.ideal_client_profile) {
        promptParts.push(`\nIMPORTANT - Context-Aware Questions: Since the user has an ideal client profile, use these context-aware versions of questions when applicable:`);
        hybridOfferQuestions.forEach(q => {
          if (q.contextAwareQuestion && !collectedAnswers[q.key]) {
            promptParts.push(`   - ${q.key}: "${q.contextAwareQuestion}"`);
          }
        });
      }
      promptParts.push(`5. responseToUser (string): This is your natural language response to the user. It will be shown directly to them.`);
      promptParts.push(`   - If validAnswer was true and isComplete is false: Briefly acknowledge their answer for '${currentQuestionDescription}'. Then, conversationally transition to ask about the topic of the nextQuestionKey. Refer to the chat history if it helps make your response more contextual.`);
      
      // Add context-aware question guidance
      if (userProfile?.ideal_client_profile) {
        promptParts.push(`   - IMPORTANT: The user has an ideal client profile on file. When asking the next question, you MUST use the context-aware version of the question provided above. Specifically:`);
        promptParts.push(`     * For targetAudience: Use the exact context-aware question: "I see you have an ideal client profile saved in your profile. Does this offer target the same audience described in your profile? If yes, just type 'same as my ideal client profile'. If it's different, please describe the specific audience for this offer. (You can view your profile by clicking 'Profile Settings' in the sidebar)"`);
        promptParts.push(`     * This acknowledges their existing profile and gives them the option to reference it or provide new information.`);
        promptParts.push(`     * Accept answers like "same as my ideal client profile", "same as my profile", "see my profile", or "check my profile" as valid references to their existing profile.`);
      }
      promptParts.push(`   - If validAnswer was true and currentQuestionKey was 'clientResult' AND isComplete is true (meaning clientResult was the last question): Acknowledge the great result. Then, transition to the completion message (e.g., "Fantastic result! That sounds like a powerful impact. Great, that's all the information I need for your hybrid offer! I'll start putting that together for you now."). Do NOT ask for more details about the client result if it was already deemed valid and it completes the questionnaire.`);
      promptParts.push(`   - If validAnswer was false: Gently explain why more information or a different kind of answer is needed for '${currentQuestionDescription}'. Be specific about what aspect was missing or why their answer addressed a different topic than what was asked. For example: "I see you're sharing about your pricing structure, which is great information we'll cover soon! Right now though, I'd like to understand more about your unique solution approach - how exactly do you solve the problems your clients face?"`);
      promptParts.push(`   - If isComplete is true (and it wasn't handled by the specific clientResult completion case above): Acknowledge that all information has been gathered. Let them know the document generation process will begin (e.g., "Great, that's all the information I need for your hybrid offer! I'll start putting that together for you now.").`);
      promptParts.push(`   - General Guidance: Do NOT just state the next question from the list. Instead, weave it into a natural, flowing conversation. For example, instead of just 'What is your pricing?', you could say, 'Thanks for sharing that! Moving on, could you tell me a bit about your pricing structure?'. Don't say exactly this sentence every time, vary your responses, so it feels more natural conversationally.`);
      
      // Add the new section on conversational approach and probing questions
      promptParts.push(`   - IMPORTANT - Probing for Better Answers: When an answer is provided but lacks sufficient detail:
         1. Ask specific follow-up questions rather than general ones
         2. For example, instead of "Can you elaborate more?", ask "What specific techniques do you use to solve their lead generation problems?"
         3. Offer examples of what you're looking for: "For instance, do you use automation software, manual outreach, or some combination?"
         4. If they seem confused by the question, rephrase it using simpler language
         5. If they've misunderstood the question topic completely, be direct but kind: "I think we might be talking about different things. I'm asking about [current topic], but you're sharing about [what they're actually talking about]"
         6. Guide them with "starter phrases" if helpful: "You might start by explaining the main components of your solution..."
         7. Only move on to the next question when you have a clear, on-topic answer for the current question`);
      
      promptParts.push(`   - IMPORTANT - Natural Conversation Flow: Your primary goal is to have a natural conversation. When a user responds:
         1. First, genuinely engage with whatever they've shared - comment on it, ask follow-up questions if relevant, or share a brief insight
         2. If they've answered the wrong question, acknowledge what they shared is valuable but kindly redirect them
         3. If they're discussing something off-topic, spend time engaging with that topic first, then transition back
         4. Use phrases like "By the way...", "Speaking of which...", "That reminds me...", or "I'm also curious about..." when transitioning
         5. If the user asks you questions, answer them honestly and thoroughly before gently returning to the offer structure
         6. Remember that getting good quality, on-topic answers is more important than rushing through all the questions quickly`);
      
      promptParts.push(`---`);
      promptParts.push(`\nReturn ONLY a JSON object with the following structure (no other text before or after the JSON):`);
      promptParts.push(`{`);
      promptParts.push(`  "validAnswer": boolean,`);
      promptParts.push(`  "savedAnswer": string | null,`);
      promptParts.push(`  "nextQuestionKey": string | null,`);
      promptParts.push(`  "isComplete": boolean,`);
      promptParts.push(`  "responseToUser": string`);
      promptParts.push(`}`);
      const analyzingPrompt = promptParts.join('\n');
      
      // Use all messages for context to the AI, but the prompt focuses on the latest one for specific analysis.
      // The system prompt itself contains the instructions and context from collectedAnswers and history.
      const messagesForOpenAI = [
        { role: "system", content: analyzingPrompt },
        // Pass only the user's last message, as the system prompt already incorporates history and asks to analyze it.
        // Or, pass a few recent messages if the model handles that better for conversational flow, despite system prompt.
        // Let's try with the full message list for context, up to a reasonable limit.
        // The prompt guides the AI to focus on the LATEST user message for its structured output.
        ...messages 
      ];

      // Add an extra validation step to ensure answers are relevant to the current question
      // Only do this for non-initial messages (when there's a current question to validate against)
      if (currentQuestionKey && messages.length > 0 && messages[messages.length - 1].role === 'user') {
        const latestUserMessage = messages[messages.length - 1].content;
        console.log(`[CHAT_API_DEBUG] Running additional validation for answer to '${currentQuestionKey}': "${latestUserMessage.substring(0, 50)}..."`);
        
        try {
          // First, validate the answer using our dedicated validation function
          const validationResult = await validateHybridOfferAnswer(currentQuestionKey, latestUserMessage, userProfile);
          
                      if (!validationResult.isValid) {
              console.log(`[CHAT_API_DEBUG] Answer validation failed for '${currentQuestionKey}': ${validationResult.reason}`);
              
              let invalidAnswerResponse;
              
              // Special handling for ideal client profile requirement
              if (validationResult.needsPsychographicBrief) {
                invalidAnswerResponse = `${validationResult.reason}\n\nTo get started with the Ideal Client Extractor tool, just type "ideal client extractor" or click on the tool from the main menu. Once you've completed that, come back and we'll continue with your hybrid offer!`;
              } else {
                // Generate helpful clarifying questions instead of rejections
                const questionInfo = hybridOfferQuestions.find(q => q.key === currentQuestionKey);
                const questionDescription = questionInfo?.description || currentQuestionKey;
                
                // Create helpful clarifying questions based on the question type
                let clarifyingQuestion = "";
                switch (currentQuestionKey) {
                  case 'phases':
                    clarifyingQuestion = "I can see you're describing your process, which is great! For the client transformation journey, I'm looking for the phases your clients experience emotionally or in their business growth. For example:\n\n• Struggling → Learning → Growing → Thriving\n• Confused → Clarity → Implementation → Success\n• Overwhelmed → Organized → Optimized → Scaling\n\nWhat phases do your clients go through in their transformation with you?";
                    break;
                  case 'uniqueMechanism':
                    clarifyingQuestion = "Thanks for sharing! I'm looking for a name or title for your unique system/methodology. Do you have a branded name for your approach (like 'The 3K Code' or 'Daily Client Machine')? If not, just say 'please create one' and we'll generate a catchy name for your offer document.";
                    break;
                  case 'promiseSolution':
                    clarifyingQuestion = "I appreciate you sharing that! For the transformation you promise, what specific outcome do your clients achieve? For example: 'Double revenue in 90 days' or 'Get 50 qualified leads per month'";
                    break;
                  case 'clientResult':
                    clarifyingQuestion = "That's helpful context! Could you share a specific success story or result you've achieved for a client? Even something simple like 'helped a client increase sales by 30%' works perfectly.";
                    break;
                  default:
                    clarifyingQuestion = `I appreciate you sharing that information! To make sure I capture the right details for your ${questionDescription}, could you tell me more specifically about that aspect of your offer?`;
                }
                
                invalidAnswerResponse = clarifyingQuestion;
              }
              
              // Create response payload without advancing to next question
              toolResponsePayload = {
                message: invalidAnswerResponse,
                currentQuestionKey: currentQuestionKey, // Stay on current question
                collectedAnswers: { ...collectedAnswers }, // Keep existing answers
                questionsAnswered: calculateQuestionsAnswered(collectedAnswers),
                isComplete: false,
                chatId: chatId,
                needsPsychographicBrief: validationResult.needsPsychographicBrief || false
              };
              
              // Return early with this helpful clarifying response
              console.log('[CHAT_API_DEBUG] Returning early with clarifying question response');
              return NextResponse.json(toolResponsePayload);
            } else {
            console.log(`[CHAT_API_DEBUG] Answer validation passed for '${currentQuestionKey}'`);
          }
        } catch (validationError) {
          console.error('[CHAT_API_DEBUG] Error in answer validation:', validationError);
          // Continue with normal processing if validation throws an error
        }
      }
      
      console.log('[CHAT_API_DEBUG] Sending analyzing prompt for hybrid-offer (conversational):', analyzingPrompt);
      console.log('[CHAT_API_DEBUG] Messages for OpenAI:', JSON.stringify(messagesForOpenAI.slice(-6))); // Log last few messages sent


      const analyzingCompletion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: messagesForOpenAI, // Pass the constructed messages
        temperature: 0.7, // Reduced temperature for more accuracy in validation while maintaining conversational tone
        response_format: { type: "json_object" }
      });
      
      const analysisResultString = analyzingCompletion.choices[0].message.content;
      console.log('[CHAT_API_DEBUG] Raw analysisResult string:', analysisResultString);
      const analysisResult = JSON.parse(analysisResultString);
      console.log('[CHAT_API_DEBUG] Conversational Analysis result:', analysisResult);
      
      determinedAiResponseContent = analysisResult.responseToUser;
      const tempCollectedAnswers = { ...collectedAnswers };
      
      const currentKeyForSaving = hybridOfferQuestions.find(q => q.key === currentQuestionKey)?.key || currentQuestionKey;


      if (analysisResult.validAnswer && analysisResult.savedAnswer) {
        tempCollectedAnswers[currentKeyForSaving] = analysisResult.savedAnswer;
      }
      
      const finalQuestionsAnswered = calculateQuestionsAnswered(tempCollectedAnswers, tool);
      let finalNextQuestionKey = analysisResult.nextQuestionKey;
      let finalIsComplete = analysisResult.isComplete;

      // If the AI indicates completion, ensure response reflects that.
      // The AI is prompted to create this message, so analysisResult.responseToUser should be appropriate.
      if (finalIsComplete) {
        finalNextQuestionKey = null; // Ensure this is null if complete
         // Potentially override with a very specific message if needed, but ideally AI handles this.
        // determinedAiResponseContent = "Thank you! I've collected all the information needed for your hybrid offer. Your document is being generated now.";
      } else if (analysisResult.validAnswer) {
        // Valid answer, not complete. AI's responseToUser should be asking the next question.
        // finalNextQuestionKey is already set by AI.
      } else {
        // Invalid answer. AI's responseToUser should be a re-prompt.
        // Ensure nextQuestionKey reflects current question if AI didn't explicitly set it.
        finalNextQuestionKey = finalNextQuestionKey || currentKeyForSaving;
      }
      
      toolResponsePayload = {
        message: determinedAiResponseContent,
        currentQuestionKey: finalNextQuestionKey,
        collectedAnswers: { ...tempCollectedAnswers },
        questionsAnswered: finalQuestionsAnswered,
        isComplete: finalIsComplete,
        chatId: chatId
      };

      // Log the constructed toolResponsePayload
      console.log('[CHAT_API_DEBUG] Constructed toolResponsePayload:', JSON.stringify(toolResponsePayload, null, 2));

    } else if (tool === 'workshop-generator') {
      console.log('[CHAT_API_DEBUG] Processing workshop generator tool logic (non-init path)');

      // ======== NEW CONTEXTUAL WORKSHOP HANDLER ========
      try {
        const { handleWorkshopConversation } = await import('@/lib/workshop/handle-workshop-conversation');
        const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || '';
        const payload = handleWorkshopConversation(lastUserMsg, chatId);
        // Merge any previously stored collectedAnswers so we don't lose data stored in DB
        payload.collectedAnswers = { ...collectedAnswers, ...payload.collectedAnswers };
        // Persist payload back into thread metadata (best-effort)
        try {
          await supabase
            .from('threads')
            .update({ metadata: {
              currentQuestionKey: payload.currentQuestionKey,
              questionsAnswered: payload.questionsAnswered,
              isComplete: payload.isComplete,
              collectedAnswers: payload.collectedAnswers
            }})
            .eq('id', chatId);
        } catch(dbUpdateErr) {
          console.error('[CHAT_API_DEBUG] Failed updating thread metadata with new handler', dbUpdateErr);
        }
        return NextResponse.json(payload);
      } catch(handlerErr) {
        console.error('[CHAT_API_DEBUG] New workshop handler failed', handlerErr);
      }
      // ======== END NEW CONTEXTUAL HANDLER ========

      currentQuestionKey = body.currentQuestionKey || 'participantOutcomes';
      const currentQuestionsAnswered = calculateQuestionsAnswered(collectedAnswers, tool);
      const totalQuestions = workshopQuestions.length;

      // Check if workshop is already complete and user is requesting design changes
      const isWorkshopComplete = currentQuestionsAnswered >= totalQuestions;
      const latestUserMessage = messages.length > 0 ? messages[messages.length - 1].content : "";
      
      // Keywords that indicate design change requests
      const designChangeKeywords = [
        'change', 'edit', 'modify', 'update', 'make', 'different', 'color', 'background', 
        'font', 'style', 'design', 'look', 'appearance', 'layout', 'button', 'header',
        'section', 'text', 'title', 'headline', 'darker', 'lighter', 'bigger', 'smaller',
        'professional', 'modern', 'bold', 'elegant', 'simple', 'clean', 'vibrant',
        'gradient', 'theme', 'branding', 'logo', 'image', 'photo', 'spacing', 'padding'
      ];
      
      const isDesignChangeRequest = isWorkshopComplete && 
        designChangeKeywords.some(keyword => latestUserMessage.toLowerCase().includes(keyword));

      if (isDesignChangeRequest) {
        console.log('[CHAT_API_DEBUG] Detected design change request for completed workshop');
        
        // Get the original HTML from the last assistant message that contains HTML
        let originalHTML = null;
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === 'assistant' && messages[i].content.includes('<!DOCTYPE html>')) {
            const htmlMatch = messages[i].content.match(/```html\n([\s\S]*?)\n```/);
            if (htmlMatch) {
              originalHTML = htmlMatch[1];
              break;
            }
          }
        }

        if (!originalHTML) {
          // Fallback: generate original HTML first
          console.log('[CHAT_API_DEBUG] No original HTML found, generating base template');
          originalHTML = await generateWorkshopHTML(collectedAnswers);
        }

        // Create a targeted design modification prompt that preserves structure
        const designModificationPrompt = `You are helping modify the design of an existing workshop landing page. The user wants to make specific design changes while preserving the overall structure and content.

IMPORTANT: You must preserve the exact same content, structure, and layout. Only modify the visual styling (colors, fonts, spacing) as requested.

Original HTML:
${originalHTML}

User's Design Request: "${latestUserMessage}"

Your task:
1. Analyze the user's specific design request
2. Modify ONLY the CSS styling in the <style> section to implement their changes
3. Keep all content, structure, and functionality exactly the same
4. Preserve all text, headings, sections, and layout

Common modifications:
- Color changes: Update CSS color values, gradients, backgrounds
- Background changes: Modify body background, section backgrounds
- Spacing changes: Adjust padding, margins
- Font changes: Update font-family, font-size, font-weight
- Theme changes: Apply professional/modern/bold styling

Rules:
- DO NOT change any text content or copy
- DO NOT change the HTML structure or layout
- DO NOT remove or add sections
- ONLY modify CSS properties in the <style> section
- Preserve all responsive design and functionality
- Keep the same conversion-optimized layout

Return the complete modified HTML with only the CSS styling changes applied.`;

        try {
          // Use Claude Opus for targeted design modifications
          const designMessage = await anthropic.messages.create({
            model: "claude-3-opus-20240229",
            max_tokens: 4000,
            temperature: 0.3, // Lower temperature for more precise modifications
            messages: [
              {
                role: "user",
                content: designModificationPrompt
              }
            ]
          });

          const designResponse = designMessage.content[0].text;
          
          // Extract HTML from Claude's response
          let modifiedHTML = designResponse;
          const htmlMatch = designResponse.match(/```html\n([\s\S]*?)\n```/);
          if (htmlMatch) {
            modifiedHTML = htmlMatch[1];
          } else if (designResponse.includes('<!DOCTYPE html>')) {
            // If HTML is not in code blocks, extract it directly
            const htmlStart = designResponse.indexOf('<!DOCTYPE html>');
            const htmlEnd = designResponse.lastIndexOf('</html>') + 7;
            if (htmlStart !== -1 && htmlEnd !== -1) {
              modifiedHTML = designResponse.substring(htmlStart, htmlEnd);
            }
          } else {
            // Fallback: if no HTML found, use original with simple modifications
            console.log('[CHAT_API_DEBUG] No HTML in Claude response, applying simple modifications');
            modifiedHTML = originalHTML;
            
            // Apply simple CSS modifications based on common requests
            if (latestUserMessage.toLowerCase().includes('dark') && latestUserMessage.toLowerCase().includes('grey')) {
              modifiedHTML = modifiedHTML.replace(
                /background: linear-gradient\(135deg, [^)]+\);/g,
                'background: linear-gradient(135deg, #374151 0%, #4b5563 100%);'
              );
            } else if (latestUserMessage.toLowerCase().includes('dark') && latestUserMessage.toLowerCase().includes('gray')) {
              modifiedHTML = modifiedHTML.replace(
                /background: linear-gradient\(135deg, [^)]+\);/g,
                'background: linear-gradient(135deg, #374151 0%, #4b5563 100%);'
              );
            } else if (latestUserMessage.toLowerCase().includes('blue')) {
              modifiedHTML = modifiedHTML.replace(
                /background: linear-gradient\(135deg, [^)]+\);/g,
                'background: linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%);'
              );
            } else if (latestUserMessage.toLowerCase().includes('green')) {
              modifiedHTML = modifiedHTML.replace(
                /background: linear-gradient\(135deg, [^)]+\);/g,
                'background: linear-gradient(135deg, #059669 0%, #047857 100%);'
              );
            } else if (latestUserMessage.toLowerCase().includes('red')) {
              modifiedHTML = modifiedHTML.replace(
                /background: linear-gradient\(135deg, [^)]+\);/g,
                'background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);'
              );
            } else if (latestUserMessage.toLowerCase().includes('purple')) {
              modifiedHTML = modifiedHTML.replace(
                /background: linear-gradient\(135deg, [^)]+\);/g,
                'background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);'
              );
            } else if (latestUserMessage.toLowerCase().includes('darker')) {
              // Make existing colors darker
              modifiedHTML = modifiedHTML.replace(
                /background: linear-gradient\(135deg, #([a-fA-F0-9]{6}) 0%, #([a-fA-F0-9]{6}) 100%\);/g,
                (match, color1, color2) => {
                  // Convert hex to darker version (simple approach)
                  const darkerColor1 = '#' + color1.replace(/./g, (c) => Math.max(0, parseInt(c, 16) - 2).toString(16));
                  const darkerColor2 = '#' + color2.replace(/./g, (c) => Math.max(0, parseInt(c, 16) - 2).toString(16));
                  return `background: linear-gradient(135deg, ${darkerColor1} 0%, ${darkerColor2} 100%);`;
                }
              );
            }
          }
          
          determinedAiResponseContent = `Acknowledged! I've updated the design based on your request: "${latestUserMessage}"

Updated HTML:

\`\`\`html
${modifiedHTML}
\`\`\`

**Changes made:**
- Applied your requested design modifications
- Preserved all original content and structure
- Maintained responsive design and functionality

**Instructions:**
1. Copy the HTML code above
2. In HighLevel, go to Sites → Pages → Create New Page
3. Choose "Custom Code" or "Blank Page"
4. Paste the HTML code into the custom code section
5. Save and publish your landing page

Feel free to request any additional design changes!`;
          
          toolResponsePayload = {
            message: determinedAiResponseContent,
            currentQuestionKey: null,
            collectedAnswers: { ...collectedAnswers },
            questionsAnswered: currentQuestionsAnswered,
            isComplete: true,
            chatId: chatId,
            isDesignEdit: true
          };

        } catch (error) {
          console.error('[CHAT_API_DEBUG] Error generating design modifications:', error);
          determinedAiResponseContent = `I understand you'd like to make design changes to your workshop landing page. However, I encountered an error processing your request. Could you please try rephrasing your design request? For example:
          
- "Make the background darker"
- "Change the colors to blue and white"
- "Make it look more professional"
- "Add more spacing between sections"

I'll be happy to regenerate the HTML with your specific changes!`;
          
          toolResponsePayload = {
            message: determinedAiResponseContent,
            currentQuestionKey: null,
            collectedAnswers: { ...collectedAnswers },
            questionsAnswered: currentQuestionsAnswered,
            isComplete: true,
            chatId: chatId
          };
        }

      } else {
        // Original workshop question flow logic
        // Prepare chat history for the prompt
        const recentHistoryMessages = messages.slice(-5);
        let chatHistoryString = "No recent history available.";
        if (recentHistoryMessages.length > 0) {
          chatHistoryString = recentHistoryMessages.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n');
        }
        const latestUserMessageContent = messages.length > 0 ? messages[messages.length - 1].content : "";
        const currentQuestionDetails = workshopQuestions.find(q => q.key === currentQuestionKey);
        const currentQuestionDescription = currentQuestionDetails?.description || 'the current topic';
        const currentQuestionText = currentQuestionDetails?.question || 'this aspect of your workshop';

        let promptParts = [];
        promptParts.push("You are a friendly and helpful AI assistant guiding a user through creating a workshop. Your goal is to gather specific pieces of information by asking questions in a conversational manner.");
        promptParts.push("Your tone should be friendly, encouraging, conversational, and engaging. Adapt your language based on the user's style in the chat history.");

        promptParts.push(`\nInformation collected so far for the workshop (${currentQuestionsAnswered}/${totalQuestions} questions answered):`);
        workshopQuestions.forEach((q, index) => {
          if (collectedAnswers[q.key]) {
            promptParts.push(`✓ ${index + 1}. ${q.description}: Answered`);
          } else {
            promptParts.push(`◯ ${index + 1}. ${q.description}: Not yet discussed`);
          }
        });

        promptParts.push(`\nWe are currently focusing on: '${currentQuestionDescription}' (Key: ${currentQuestionKey}). The guiding question for this topic is: "${currentQuestionText}"`);

        promptParts.push(`\nRecent Conversation History (last 5 messages):`);
        promptParts.push(chatHistoryString);

        promptParts.push(`\n---`);
        promptParts.push(`Your Tasks based on the User's LATEST message ("${latestUserMessageContent}"):`);
        promptParts.push(`1. validAnswer (boolean): Is the user's latest message a relevant and sufficient answer for '${currentQuestionDescription}'? Apply reasonable judgment based on the specific question context.`);
        
        promptParts.push(`   IMPORTANT - Workshop Validation Criteria: When evaluating if an answer is valid (validAnswer=true):
           * The answer MUST be relevant to the current question topic
           * The answer should address the core of what's being asked, not tangential information
           * Pay attention to question/answer mismatch - if asking about participant outcomes but user discusses pricing, the answer is NOT valid
           * Consider the context of previous exchanges - if the user has provided details across multiple messages, consider the cumulative information
           * If the user asks a question instead of answering, this is NOT a valid answer
           * If the user's response is completely off-topic, mark as invalid and redirect them
           * For workshop questions, sufficient answers might look like:
              - participantOutcomes: "Participants will learn how to create a 90-day business plan and leave with a completed action plan"
              - targetAudience: "Small business owners who struggle with planning and need structure"
              - problemAddressed: "They don't know how to create actionable business plans"
              - workshopDuration: "Full-day workshop, 8 hours with breaks"
              - topicsAndActivities: "Business planning fundamentals, goal setting exercises, action plan creation"
              - resourcesProvided: "Workbook, templates, 30-day email follow-up sequence"
           * When an answer is invalid because it's addressing the wrong topic:
              1. Clearly but kindly explain that they're discussing a different aspect than what was asked
              2. Acknowledge what they shared
              3. Redirect them to the current question with a more specific prompt
           * If they've attempted to answer the question but provided insufficient details, probe deeper with specific follow-up questions`);
        
        promptParts.push(`2. savedAnswer (string): If validAnswer is true, extract or summarize the core information provided by the user for '${currentQuestionDescription}'. This will be saved. If validAnswer is false, this can be an empty string or null.`);
        promptParts.push(`3. isComplete (boolean): After considering the user's latest answer, are all ${totalQuestions} workshop questions now answered?`);
        promptParts.push(`4. nextQuestionKey (string):`);
        promptParts.push(`   - If validAnswer is true AND isComplete is false: Determine the *key* of the *next* unanswered question from this list: ${workshopQuestions.map(q => q.key).join(", ")}. The next question should be the first one in the sequence that hasn't been answered yet.`);
        promptParts.push(`   - If validAnswer is false: This should be the *current* currentQuestionKey (${currentQuestionKey}), as we need to re-ask or clarify.`);
        promptParts.push(`   - If isComplete is true: This can be null.`);
        promptParts.push(`5. responseToUser (string): This is your natural language response to the user. It will be shown directly to them.`);
        promptParts.push(`   - If validAnswer was true and isComplete is false: Briefly acknowledge their answer for '${currentQuestionDescription}'. Then, conversationally transition to ask about the topic of the nextQuestionKey.`);
        promptParts.push(`   - If validAnswer was true and isComplete is true: Acknowledge that all information has been gathered. Say "I'm now generating your complete HTML landing page that you can paste directly into GoHighLevel." Then include this exact placeholder: <!-- GENERATE_WORKSHOP_HTML_NOW --> Do not include any other text after the placeholder.`);
        promptParts.push(`   - If validAnswer was false: Gently explain why more information or a different kind of answer is needed for '${currentQuestionDescription}'. Be specific about what aspect was missing.`);
        promptParts.push(`   - General Guidance: Do NOT just state the next question from the list. Instead, weave it into a natural, flowing conversation. Vary your responses so it feels natural and conversational.`);
        
        promptParts.push(`---`);
        promptParts.push(`\nReturn ONLY a JSON object with the following structure (no other text before or after the JSON):`);
        promptParts.push(`{`);
        promptParts.push(`  "validAnswer": boolean,`);
        promptParts.push(`  "savedAnswer": string | null,`);
        promptParts.push(`  "nextQuestionKey": string | null,`);
        promptParts.push(`  "isComplete": boolean,`);
        promptParts.push(`  "responseToUser": string`);
        promptParts.push(`}`);
        const analyzingPrompt = promptParts.join('\n');
        
        const messagesForOpenAI = [
          { role: "system", content: analyzingPrompt },
          ...messages 
        ];

        console.log('[CHAT_API_DEBUG] Sending analyzing prompt for workshop generator (conversational)');

        const analyzingCompletion = await openai.chat.completions.create({
          model: OPENAI_MODEL,
          messages: messagesForOpenAI,
          temperature: 0.7,
          response_format: { type: "json_object" }
        });
        
        const analysisResultString = analyzingCompletion.choices[0].message.content;
        console.log('[CHAT_API_DEBUG] Raw workshop analysis result string:', analysisResultString);
        const analysisResult = JSON.parse(analysisResultString);
        console.log('[CHAT_API_DEBUG] Workshop Analysis result:', analysisResult);
        
        determinedAiResponseContent = analysisResult.responseToUser;
        const tempCollectedAnswers = { ...collectedAnswers };
        
        const currentKeyForSaving = workshopQuestions.find(q => q.key === currentQuestionKey)?.key || currentQuestionKey;

        if (analysisResult.validAnswer && analysisResult.savedAnswer) {
          tempCollectedAnswers[currentKeyForSaving] = analysisResult.savedAnswer;
        }
        
        const finalQuestionsAnswered = calculateQuestionsAnswered(tempCollectedAnswers, tool);
        let finalNextQuestionKey = analysisResult.nextQuestionKey;
        let finalIsComplete = analysisResult.isComplete;

        if (finalIsComplete) {
          finalNextQuestionKey = null;
          
          // Check if the AI wants to generate HTML
          if (determinedAiResponseContent && determinedAiResponseContent.includes('<!-- GENERATE_WORKSHOP_HTML_NOW -->')) {
            console.log('[CHAT_API_DEBUG] Detected HTML generation request for workshop');
            
            // Generate the HTML using the template and collected answers
            const generatedHTML = await generateWorkshopHTML(tempCollectedAnswers);
            
            // Replace the placeholder with the actual HTML in a code block and add design edit instructions
            determinedAiResponseContent = determinedAiResponseContent.replace(
              '<!-- GENERATE_WORKSHOP_HTML_NOW -->',
              `\n\n**Landing Page Preview:**\n\n\`\`\`html\n${generatedHTML}\n\`\`\`\n\n**Perfect! I have all the information needed to create your workshop landing page.**\n\n**Instructions:**\n1. Copy the HTML code above\n2. In HighLevel, go to Sites → Pages → Create New Page\n3. Choose "Custom Code" or "Blank Page"\n4. Paste the HTML code into the custom code section\n5. Save and publish your landing page\n\n**Want to make changes?** Just tell me what you'd like to modify! For example:\n- "Make the background darker"\n- "Change the colors to blue and white"\n- "Make it look more professional"\n- "Add more spacing between sections"\n\nI'll regenerate the HTML with your requested changes instantly!`
            );
            
            console.log('[CHAT_API_DEBUG] HTML generated and inserted into response');
          }
        } else if (analysisResult.validAnswer) {
          // Valid answer, not complete. AI's responseToUser should be asking the next question.
          // finalNextQuestionKey is already set by AI.
        } else {
          // Invalid answer. AI's responseToUser should be a re-prompt.
          finalNextQuestionKey = finalNextQuestionKey || currentKeyForSaving;
        }
        
        toolResponsePayload = {
          message: determinedAiResponseContent,
          currentQuestionKey: finalNextQuestionKey,
          collectedAnswers: { ...tempCollectedAnswers },
          questionsAnswered: finalQuestionsAnswered,
          isComplete: finalIsComplete,
          chatId: chatId
        };

        console.log('[CHAT_API_DEBUG] Constructed workshop toolResponsePayload:', JSON.stringify(toolResponsePayload, null, 2));
      }
    } else if (tool === 'daily-client-machine') {
      console.log('[CHAT_API_DEBUG] Processing daily-client-machine tool logic (page-by-page approach)');
      
      // For daily-client-machine, we use GPT-4o for cost-effective copywriting
      const toolConfig = TOOLS[tool];
      
      // Build enhanced system message with full profile context and detailed validation requirements
      let enhancedSystemMessage = `${toolConfig.systemMessage}

CRITICAL VALIDATION REQUIREMENTS:
You must require DETAILED, SPECIFIC responses before accepting any answer. Do not accept vague or generic responses.

INSUFFICIENT EXAMPLES TO REJECT:
- "help businesses scale" → ASK: "Scale how? From what revenue to what revenue? Using what specific method?"
- "consulting services" → ASK: "What type of consulting? For which industry? What specific outcome do you deliver?"
- "AI solutions" → ASK: "What specific AI solution? For what problem? What measurable result does it produce?"
- "marketing help" → ASK: "What type of marketing? For which businesses? What specific growth outcome?"

SUFFICIENT EXAMPLES TO ACCEPT:
- "help B2B service businesses scale from $50K to $500K ARR using our 90-day AI-powered lead generation system"
- "teach overwhelmed real estate agents how to get 10-15 qualified leads per month through Facebook ads and automated follow-up"
- "help burned-out entrepreneurs systematize their operations so they work 20 hours less while increasing revenue by 30%"

RESPONSE VALIDATION PROCESS:
1. If response is vague/generic: Acknowledge what they shared, explain why you need more detail, ask specific follow-up questions
2. If response is detailed/specific: Accept it and move to next question
3. Always reference their profile context when available
4. Provide examples relevant to their industry/situation`;

      if (userProfile) {
        // Use the full profile context that includes psychographic brief
        const { buildProfileContext } = await import('@/lib/utils/ai');
        const profileContext = await buildProfileContext(userProfile);
        enhancedSystemMessage += `

PROFILE CONTEXT:
${profileContext}

PROFILE USAGE INSTRUCTIONS:
        - If they have an ideal client profile: Reference it immediately, use it to personalize all questions and examples
- If they have occupation info: Use it to provide industry-specific guidance and skip basic profession questions  
- If missing profile info: Gather it naturally during the conversation to improve personalization
- Always acknowledge their existing context before asking for more details
- Use language and examples that resonate with their specific industry and situation`;
        
        console.log('[CHAT_API_DEBUG] Added profile context to DCM tool:', {
          hasOccupation: !!userProfile.occupation,
          hasPsychographicBrief: !!userProfile.ideal_client_profile,
          profileContextLength: profileContext.length
        });
      } else {
        enhancedSystemMessage += `

PROFILE CONTEXT: No profile context available - gather this information as needed during the conversation.`;
      }
      
      // Enhance with James's proven DCM template reference data
      try {
        const { enhanceDCMPromptWithJamesTemplates } = await import('@/lib/utils/highlevel-docs');
        const { detectDCMRequestType, buildDCMPrompt } = await import('@/prompts/dcm-modular-prompts');
        
        // Detect request type using intelligent analysis
        const userMessage = messages[messages.length - 1]?.content || '';
        const requestType = detectDCMRequestType(userMessage);
        
        console.log('[CHAT_API_DEBUG] DCM Request Type Detected:', {
          requestType,
          userMessage: userMessage.substring(0, 100) + '...',
          messageLength: userMessage.length
        });
        
        // Get current answers for context
        const currentAnswers = { ...collectedAnswers };
        
        // Build specialized prompt based on request type
        let specializedPrompt = buildDCMPrompt(requestType, userProfile, currentAnswers);
        
        // Enhance with James's template reference data
        enhancedSystemMessage = await enhanceDCMPromptWithJamesTemplates(specializedPrompt, currentAnswers, requestType);
        
        console.log('[CHAT_API_DEBUG] Enhanced DCM with modular prompt system:', {
          requestType,
          hasTemplateData: enhancedSystemMessage.includes('JAMES\'S PROVEN DCM'),
          messageLength: enhancedSystemMessage.length,
          isSpecialized: enhancedSystemMessage.includes('You are the DCM')
        });
        
      } catch (error) {
        console.error('[CHAT_API_DEBUG] Failed to enhance DCM prompt with modular system:', error);
        // Fallback to original system
        try {
          const { enhanceDCMPromptWithJamesTemplates } = await import('@/lib/utils/highlevel-docs');
          const currentAnswers = { ...collectedAnswers };
          enhancedSystemMessage = await enhanceDCMPromptWithJamesTemplates(enhancedSystemMessage, currentAnswers, 'build-from-scratch');
        } catch (fallbackError) {
          console.error('[CHAT_API_DEBUG] Fallback DCM prompt enhancement also failed:', fallbackError);
        }
      }
      
      // Retrieve thread metadata to get collected answers and current page
      let threadMetadata = {};
      let currentAnswers = { ...collectedAnswers };
      let currentPageId = 'opt-in'; // Default to first page
      
      if (chatId && supabase) {
        try {
          const { data: threadData, error: threadError } = await supabase
            .from('threads')
            .select('metadata')
            .eq('id', chatId)
            .single();
          
          if (!threadError && threadData?.metadata) {
            threadMetadata = threadData.metadata;
            if (threadMetadata.collectedAnswers) {
              Object.assign(currentAnswers, threadMetadata.collectedAnswers);
            }
            if (threadMetadata.currentPageId) {
              currentPageId = threadMetadata.currentPageId;
            }
            console.log('[CHAT_API_DEBUG] Retrieved thread metadata - Page:', currentPageId, 'Answers:', Object.keys(currentAnswers));
          }
        } catch (error) {
          console.error('[CHAT_API_DEBUG] Error retrieving thread metadata:', error);
        }
      }
      
      // Determine the current page based on completed answers
      const currentPage = toolConfig.getCurrentPage ? toolConfig.getCurrentPage(currentAnswers) : toolConfig.pages[0];
      const currentPageIndex = currentPage && currentPage.id !== 'foundation' ? 
        toolConfig.pages.findIndex(p => p.id === currentPage.id) : -1;
      
      console.log('[CHAT_API_DEBUG] Current page:', currentPage?.name, 'Index:', currentPageIndex);
      
      // Check if we just completed foundation questions and need to show architecture
      const progress = toolConfig.getProgress ? toolConfig.getProgress(currentAnswers) : null;
      const justCompletedFoundation = progress && 
        progress.foundation.complete && 
        (!threadMetadata.foundationShown) &&
        currentPage && currentPage.id !== 'foundation';
      
      if (justCompletedFoundation) {
        console.log('[CHAT_API_DEBUG] Foundation complete - showing funnel architecture');
        
        // Generate funnel architecture visualization
        const architectureMessage = `# 🎯 YOUR DAILY CLIENT MACHINE ARCHITECTURE

Based on your foundation:
- **Problem:** ${currentAnswers.bigIdea}
- **Method:** ${currentAnswers.uniqueMechanism}
- **Audience:** ${currentAnswers.targetAvatar}

## 📊 Your Complete Funnel Structure:

**FRONT-END FUNNEL (Info Path)**
1. **Opt-in Page** → Free guide about ${currentAnswers.uniqueMechanism}
2. **$27-47 Product** → Implementation training
3. **$17-37 Order Bump** → Templates/tools
4. **$197-497 Upsell** → Done-with-you program
5. **Thank You** → Set expectations & deliver value

**BACK-END FUNNEL (Insight Path)**
6. **$47-97/month Membership** → Ongoing support & community
7. **$2k-10k High Ticket** → 1-on-1 transformation (booked from membership)

**The Magic:** Your low-ticket customers fund ads to find high-ticket clients!

---

**Ready to build?** Let's start with your opt-in page. I'll ask you one question at a time, then generate professional copy for each page.

First question coming up...`;
        
        // Update metadata to show foundation was displayed
        const updatedMetadata = {
          ...threadMetadata,
          collectedAnswers: currentAnswers,
          foundationShown: true,
          currentPageId: currentPage.id
        };
        
        toolResponsePayload = {
          message: architectureMessage,
          currentPageId: currentPage.id,
          currentPageIndex: 0,
          collectedAnswers: currentAnswers,
          pageComplete: false,
          totalPages: toolConfig.pages.length,
          isComplete: false,
          chatId: chatId,
          metadata: updatedMetadata
        };
        
        // Save thread metadata immediately
        if (chatId && supabase) {
          await supabase
            .from('threads')
            .update({ metadata: updatedMetadata })
            .eq('id', chatId);
        }
        
      }
      // Check if current page is complete and should generate copy
      else if (currentPage && currentPage.id !== 'foundation') {
        var isCurrentPageComplete = toolConfig.isPageComplete(currentPage.id, currentAnswers);
      } else {
        var isCurrentPageComplete = false;
      }
      
             // Check if user is requesting to generate copy for current page or move to next page
       const shouldGeneratePageCopy = isCurrentPageComplete && (
         body.generatePageCopy || 
         (messages.length > 0 && messages[messages.length - 1]?.content?.toLowerCase().includes('generate'))
       );
      
      // Special handling for exports and specific page generation requests
      const lastUserMessage = messages.length > 0 ? messages[messages.length - 1]?.content?.toLowerCase() || '' : '';
      
      // Handle export requests
      if (lastUserMessage.includes('export complete funnel') || lastUserMessage.includes('export all')) {
        console.log('[CHAT_API_DEBUG] Generating complete funnel export');
        
        try {
          const { generateDCMCopyTemplate } = await import('@/prompts/daily-client-machine-prompt.js');
          const completeTemplate = generateDCMCopyTemplate(currentAnswers);
          
          const exportMessage = `# 🎉 Your Complete Daily Client Machine Export

${completeTemplate}

---

**💾 NEXT STEPS:**
1. **Copy this entire document** and save it as your funnel reference
2. **Log into HighLevel** and clone the DCM 2.0 template funnel
3. **Replace the template copy** with your personalized copy above
4. **Test each page** before launching traffic
5. **Set up tracking** to monitor performance

**Questions?** Just ask and I'll help you implement any specific page!`;
          
          toolResponsePayload = {
            message: exportMessage,
            currentPageId: 'export',
            currentPageIndex: 8,
            collectedAnswers: currentAnswers,
            pageComplete: true,
            totalPages: toolConfig.pages.length,
            isComplete: true,
            chatId: chatId,
            metadata: updatedMetadata
          };
          
        } catch (error) {
          console.error('[CHAT_API_DEBUG] Error generating export:', error);
          toolResponsePayload = {
            message: "I encountered an issue generating your export. Let me help you continue building your funnel step by step instead.",
            error: true,
            chatId: chatId
          };
        }
      }
      // Handle specific page generation requests
      else if (lastUserMessage.includes('generate') && (
        lastUserMessage.includes('sales page') || 
        lastUserMessage.includes('order form') || 
        lastUserMessage.includes('upsell') ||
        lastUserMessage.includes('thank you') ||
        lastUserMessage.includes('membership') ||
        lastUserMessage.includes('delivery')
      )) {
        console.log('[CHAT_API_DEBUG] Generating specific page copy');
        
        try {
          const { generatePageCopy } = await import('@/prompts/daily-client-machine-prompt.js');
          
          // Determine which page to generate
          let targetPageId = 'opt-in';
          if (lastUserMessage.includes('sales')) targetPageId = 'sales-page';
          else if (lastUserMessage.includes('order form')) targetPageId = 'order-form';
          else if (lastUserMessage.includes('upsell')) targetPageId = 'upsell';
          else if (lastUserMessage.includes('thank you')) targetPageId = 'thank-you';
          else if (lastUserMessage.includes('membership')) targetPageId = 'membership';
          else if (lastUserMessage.includes('delivery')) targetPageId = 'delivery';
          
          const pageCopy = generatePageCopy(targetPageId, currentAnswers);
          
          toolResponsePayload = {
            message: pageCopy,
            currentPageId: targetPageId,
            currentPageIndex: toolConfig.pages.findIndex(p => p.id === targetPageId),
            collectedAnswers: currentAnswers,
            pageComplete: true,
            totalPages: toolConfig.pages.length,
            isComplete: targetPageId === 'delivery',
            chatId: chatId,
            metadata: updatedMetadata
          };
          
        } catch (error) {
          console.error('[CHAT_API_DEBUG] Error generating page copy:', error);
          toolResponsePayload = {
            message: "I encountered an issue generating that page. Let me help you continue with the questions instead.",
            error: true,
            chatId: chatId
          };
        }
      }
      // Normal page copy generation flow
      else if (shouldGeneratePageCopy && currentPage) {
        console.log('[CHAT_API_DEBUG] Generating copy for page:', currentPage.name);
        
        try {
          // Import HighLevel API for enhanced copy generation
          const { enhanceDCMPromptWithTemplates } = require('@/lib/utils/highlevel-api');
          
          // Create page-specific prompt
          const pagePrompt = `You are generating copy for the ${currentPage.name} of a Daily Client Machine funnel.

PAGE CONTEXT:
- Page: ${currentPage.name}
- Description: ${currentPage.description}
- This is page ${currentPageIndex + 1} of 8 in the DCM funnel

USER'S INFORMATION:
${Object.keys(currentAnswers).map(key => `${key}: ${currentAnswers[key]}`).join('\n')}

Generate professional, conversion-focused copy for this specific page. Include:
1. Compelling headlines
2. Persuasive body copy
3. Clear call-to-action
4. Any necessary form fields or buttons

Make it specific to their business and target audience. Use proven copywriting principles.`;
          
          // Enhance with HighLevel templates if available
          console.log('[CHAT_API_DEBUG] Enhancing with HighLevel templates...');
          const enhancedPrompt = await enhanceDCMPromptWithTemplates(pagePrompt, currentAnswers);
          
          // Generate the page copy
          const copyGenerationMessages = [
            {
              role: "system",
              content: enhancedPrompt
            },
            {
              role: "user",
              content: `Generate the ${currentPage.name} copy now.`
            }
          ];
          
          console.log('[CHAT_API_DEBUG] Generating page copy with GPT-4o...');
          
          const copyResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: copyGenerationMessages,
            max_tokens: 3000,
            temperature: 0.7
          });
          
          const generatedPageCopy = copyResponse.choices[0].message.content;
          
          // Determine next page
          const nextPageIndex = currentPageIndex + 1;
          const nextPage = nextPageIndex < toolConfig.pages.length ? toolConfig.pages[nextPageIndex] : null;
          
          let responseMessage = `🎉 **${currentPage.name} Complete!** (Page ${currentPageIndex + 1}/8)

${generatedPageCopy}

---

**Progress:** ${currentPageIndex + 1} of 8 pages complete`;

          if (nextPage) {
            responseMessage += `

**Ready for the next page?**
Next up: **${nextPage.name}** - ${nextPage.description}

Would you like to continue to page ${nextPageIndex + 1}? Just say "yes" or "continue" to move forward!`;
          } else {
            responseMessage += `

🎊 **Congratulations!** Your complete Daily Client Machine funnel is ready!

**Next Steps:**
1. Save all your page copy for reference
2. Log into your HighLevel account  
3. Import the DCM 2.0 template funnel
4. Replace template content with your personalized copy
5. Test your funnel before going live

**Need any changes?** Just let me know which page you'd like to refine!`;
          }
          
          determinedAiResponseContent = responseMessage;
          
          // Update thread metadata with current page completion
          const updatedMetadata = {
            ...threadMetadata,
            collectedAnswers: currentAnswers,
            currentPageId: nextPage ? nextPage.id : 'complete',
            completedPages: [...(threadMetadata.completedPages || []), currentPage.id],
            [`${currentPage.id}Copy`]: generatedPageCopy
          };
          
          toolResponsePayload = {
            message: determinedAiResponseContent,
            currentPageId: nextPage ? nextPage.id : 'complete',
            currentPageIndex: nextPageIndex,
            collectedAnswers: currentAnswers,
            pageComplete: true,
            totalPages: toolConfig.pages.length,
            isComplete: !nextPage,
            chatId: chatId,
            metadata: updatedMetadata
          };
          
          console.log('[CHAT_API_DEBUG] Page copy generated successfully for:', currentPage.name);
          
        } catch (error) {
          console.error('[CHAT_API_DEBUG] Error generating page copy:', error);
          
          // Fallback response
          determinedAiResponseContent = `I encountered an issue generating the copy for ${currentPage.name}. Let me help you continue with the questions instead.

What would you like to do next?
1. Try generating the copy again
2. Move to the next page
3. Refine your answers for this page`;
          
          toolResponsePayload = {
            message: determinedAiResponseContent,
            currentPageId: currentPage.id,
            currentPageIndex: currentPageIndex,
            collectedAnswers: currentAnswers,
            pageComplete: false,
            error: true,
            chatId: chatId
          };
        }
        
      } else {
        // Regular question flow for current page or foundation
        console.log('[CHAT_API_DEBUG] Continuing question flow for:', currentPage?.name || 'foundation');
        
        const openaiMessages = [];
        
        // Build contextual system message based on phase
        let contextualSystemMessage = enhancedSystemMessage;
        
        if (currentPage && currentPage.id === 'foundation') {
          // Foundation phase
          const nextQuestion = toolConfig.getNextQuestion ? toolConfig.getNextQuestion(currentAnswers, userProfile) : null;
          
          contextualSystemMessage += `\n\nCURRENT PHASE: Strategic Foundation
${nextQuestion ? `Progress: ${nextQuestion.progress}` : ''}

You are establishing the foundation for their Daily Client Machine. Ask ONE question at a time.
Provide a brief example to clarify what you're looking for.
Keep it conversational but focused.`;
          
        } else if (currentPage) {
          // Page-specific phase
          contextualSystemMessage += `\n\nCURRENT PAGE: ${currentPage.name} (Page ${currentPageIndex + 1}/8)
DESCRIPTION: ${currentPage.description}

QUESTIONS FOR THIS PAGE:
${currentPage.questions.map(q => {
  // Replace placeholders in questions
  let processedQuestion = q.question;
  Object.keys(currentAnswers).forEach(key => {
    processedQuestion = processedQuestion.replace(`{${key}}`, currentAnswers[key]);
  });
  return `- ${processedQuestion}`;
}).join('\n')}`;
        }
        
        if (Object.keys(currentAnswers).length > 0) {
          contextualSystemMessage += `\n\nCOLLECTED ANSWERS:
${Object.keys(currentAnswers).map(key => `${key}: ${currentAnswers[key]}`).join('\n')}`;
        }
        
        if (currentPage && currentPage.id === 'foundation') {
          contextualSystemMessage += `\n\nYour goal: Ask the next foundation question clearly and concisely.`;
        } else {
          contextualSystemMessage += `\n\nYour goal: Ask the next unanswered question for the current page, or if the page is complete, offer to generate the page copy.`;
        }
        
        openaiMessages.push({
          role: "system",
          content: contextualSystemMessage
        });
        
                 // Add conversation history
         if (messages.length === 0) {
           openaiMessages.push({
             role: "user",
             content: "I want to build my Daily Client Machine funnel"
           });
         } else {
           messages.forEach(msg => {
             openaiMessages.push({
               role: msg.role,
               content: msg.content
             });
           });
         }
        
        try {
          console.log('[CHAT_API_DEBUG] Sending conversation to GPT-4o for page questions');
          
          const openaiResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: openaiMessages,
            max_tokens: 2000,
            temperature: 0.7
          });

          const responseContent = openaiResponse.choices[0].message.content;
          
          console.log('[CHAT_API_DEBUG] GPT-4o response received for page questions');
          
          // Analyze if user provided an answer and extract it
          let updatedAnswers = { ...currentAnswers };
          let nextQuestionKey = null;
          
          if (messages.length > 0) {
            const lastUserMessage = messages.filter(m => m.role === 'user').pop();
            
            if (lastUserMessage) {
              // Find the next unanswered question based on phase
              let unansweredQuestion = null;
              
              if (currentPage && currentPage.id === 'foundation') {
                // For foundation phase, use getNextQuestion
                const nextQ = toolConfig.getNextQuestion ? toolConfig.getNextQuestion(currentAnswers, userProfile) : null;
                if (nextQ) {
                  unansweredQuestion = nextQ;
                }
              } else if (currentPage) {
                // For page phase, find unanswered page question
                unansweredQuestion = currentPage.questions.find(q => !updatedAnswers[q.key]);
              }
              
              if (unansweredQuestion) {
                // Try to extract answer for this question with enhanced validation
                try {
                  const analysisPrompt = `Analyze if this user response contains a sufficiently detailed answer for the Daily Client Machine question.

Question: "${unansweredQuestion.question}"
User Response: "${lastUserMessage.content}"

VALIDATION CRITERIA:
- Must be specific and actionable, not vague
- Must contain enough detail to create quality marketing copy
- Must demonstrate understanding of the concept
- Must be more than just a few words or generic response

EXAMPLES OF INSUFFICIENT ANSWERS:
- "help businesses scale" (too vague)
- "consulting" (too generic)
- "I'm not sure" (no answer)
- "maybe later" (avoidance)
- "AI stuff" (too broad)

EXAMPLES OF SUFFICIENT ANSWERS:
- "help B2B service businesses scale from $50K to $500K ARR using AI-powered lead generation systems"
- "teach real estate agents how to get 10-15 qualified leads per month through Facebook ads and automated follow-up sequences"
- "help overwhelmed entrepreneurs systematize their business operations so they can work 20 hours less per week while increasing revenue"

Return JSON:
{
  "hasValidAnswer": boolean,
  "extractedAnswer": "string or null",
  "reasoning": "brief explanation of why it's valid or invalid",
  "needsMoreDetail": boolean,
  "suggestedPrompt": "what specific follow-up question to ask if more detail is needed"
}`;

                  const analysisResponse = await openai.chat.completions.create({
                    model: "gpt-4o",
                    messages: [{ role: "system", content: analysisPrompt }],
                    temperature: 0.3,
                    response_format: { type: "json_object" }
                  });
                  
                  const analysisResult = JSON.parse(analysisResponse.choices[0].message.content);
                  
                  if (analysisResult.hasValidAnswer && analysisResult.extractedAnswer) {
                    updatedAnswers[unansweredQuestion.key] = analysisResult.extractedAnswer;
                    console.log('[CHAT_API_DEBUG] Extracted answer for:', unansweredQuestion.key);
                  }
                  
                  // Store analysis result for use in response generation
                  unansweredQuestion.analysisResult = analysisResult;
                } catch (analysisError) {
                  console.error('[CHAT_API_DEBUG] Error analyzing answer:', analysisError);
                }
              }
            }
          }
          
          // Check if current page is now complete
          const pageNowComplete = currentPage ? toolConfig.isPageComplete(currentPage.id, updatedAnswers) : false;
          
          // Update thread metadata with current progress
          const updatedMetadata = {
            ...threadMetadata,
            collectedAnswers: updatedAnswers,
            currentPageId: currentPage?.id || 'opt-in',
            currentPageIndex: currentPageIndex,
            pageComplete: pageNowComplete,
            lastUpdated: new Date().toISOString()
          };
          
          toolResponsePayload = {
            message: responseContent,
            currentPageId: currentPage?.id || 'opt-in',
            currentPageIndex: currentPageIndex,
            collectedAnswers: updatedAnswers,
            pageComplete: pageNowComplete,
            totalPages: toolConfig.pages.length,
            isComplete: false,
            chatId: chatId,
            metadata: updatedMetadata
          };
          
        } catch (error) {
          console.error('[CHAT_API_DEBUG] Error in page question flow:', error);
          
          determinedAiResponseContent = "I encountered an issue. Let's continue building your Daily Client Machine. What would you like to work on?";
          
          toolResponsePayload = {
            message: determinedAiResponseContent,
            currentPageId: currentPage?.id || 'opt-in',
            currentPageIndex: currentPageIndex,
            collectedAnswers: currentAnswers,
            error: true,
            chatId: chatId
          };
        }
      }
      
      // Set determinedAiResponseContent for daily-client-machine to ensure it gets saved
      if (toolResponsePayload && toolResponsePayload.message) {
        determinedAiResponseContent = toolResponsePayload.message;
        console.log('[CHAT_API_DEBUG] Set determinedAiResponseContent for daily-client-machine');
      }
      
      // Save thread metadata for daily-client-machine tool
      if (chatId && supabase && toolResponsePayload.metadata) {
        try {
          const { error: threadUpdateError } = await supabase
            .from('threads')
            .update({ metadata: toolResponsePayload.metadata })
            .eq('id', chatId);
          
          if (threadUpdateError) {
            console.error('[CHAT_API_DEBUG] Error updating thread metadata:', threadUpdateError);
          } else {
            console.log('[CHAT_API_DEBUG] Thread metadata updated successfully for daily-client-machine');
          }
        } catch (error) {
          console.error('[CHAT_API_DEBUG] Exception updating thread metadata:', error);
        }
      }
      
    } else if (tool === 'ideal-client-extractor') {
      console.log('[CHAT_API_DEBUG] Processing ideal-client-extractor tool logic (non-init path)');
      
      // For ideal-client-extractor, we use Claude Opus for the entire conversation
      const toolConfig = TOOLS[tool];
      
      // Build enhanced system message with profile context
      let enhancedSystemMessage = toolConfig.systemMessage;
      if (userProfile && userProfile.occupation) {
        // Insert the occupation context at the beginning of the system message
        const contextPrefix = `IMPORTANT CONTEXT: The user is a ${userProfile.occupation}. Use this information to ask more targeted questions and avoid asking about their general profession since you already know it. Focus on the specifics of their offering, target market, and customer psychology.\n\n`;
        enhancedSystemMessage = toolConfig.systemMessage.replace(
          'You are a master copywriting strategist',
          contextPrefix + 'You are a master copywriting strategist'
        );
      }
      
      // Add extended thinking instructions if enabled
      if (toolConfig.extendedThinking && toolConfig.thinkingInstructions) {
        enhancedSystemMessage = `${enhancedSystemMessage}\n\n${toolConfig.thinkingInstructions}`;
      }
      
      // Prepare the conversation for Claude Opus
      const claudeMessages = messages.map(m => ({ role: m.role, content: m.content }));
      
      try {
        console.log('[CHAT_API_DEBUG] Sending conversation to Claude Opus for ideal-client-extractor');
        
        const claudeResponse = await anthropic.messages.create({
          model: "claude-opus-4-20250514",
          max_tokens: toolConfig.maxTokens || 8000,
          temperature: toolConfig.temperature || 0.85,
          top_p: toolConfig.topP || 0.95,
          system: enhancedSystemMessage,
          messages: claudeMessages
        });

        const responseContent = claudeResponse.content[0].text;
        
        console.log('[CHAT_API_DEBUG] Claude Opus response received for ideal-client-extractor');
        
        // Check if this response contains a comprehensive ideal client profile and auto-save it
        const briefSaved = await detectAndSavePsychographicBrief(responseContent, userId);
        
        // Set the response content so it gets saved to the database
        determinedAiResponseContent = responseContent;
        
        toolResponsePayload = {
          message: responseContent,
          currentQuestionKey: null, // No predefined questions
          collectedAnswers: {}, // No structured answers to collect
          questionsAnswered: 0, // Not applicable for this tool
          isComplete: false, // Let the conversation flow naturally
          chatId: chatId
        };
        
        console.log('[CHAT_API_DEBUG] Constructed ideal-client-extractor toolResponsePayload');
        
        // Add a flag to the response payload to indicate brief was saved
        if (briefSaved) {
          toolResponsePayload = {
            ...toolResponsePayload,
            psychographicBriefSaved: true
          };
        }
        
      } catch (claudeError) {
        console.error('[CHAT_API_DEBUG] Error calling Claude Opus for ideal-client-extractor:', claudeError);
        
        // Fallback response
        determinedAiResponseContent = "I apologize, but I'm having trouble processing your request right now. Could you please try again?";
        
        toolResponsePayload = {
          message: "I apologize, but I'm having trouble processing your request right now. Could you please try again?",
          currentQuestionKey: null,
          collectedAnswers: {},
          questionsAnswered: 0,
          isComplete: false,
          chatId: chatId
        };
      }
    } else if (!tool) {
      console.log('[CHAT_API_DEBUG] Using 2-step coaching process for regular chat');
      try {
        // STEP 0: Get coaching context for this user
        console.log('[CHAT_API_DEBUG] Step 0: Retrieving coaching context');
        const coachingContext = await getCoachingContext(userId);
        console.log('[CHAT_API_DEBUG] Coaching context retrieved, length:', coachingContext.length);
        
        // STEP 1: Query the vector store to get relevant information
        console.log('[CHAT_API_DEBUG] Step 1: Querying vector store for relevant information');
        
        const latestUserMessage = messages.length > 0 ? messages[messages.length - 1].content : "";
        const searchQuery = latestUserMessage; // Use the latest user message as search query
        
        const vectorSearchResponse = await openai.responses.create({
          model: OPENAI_MODEL,
          input: [
            {
              role: "system",
              content: `You are a knowledge retrieval assistant. Your job is to find and extract relevant information from the knowledge base to help answer the user's question. Be comprehensive but focused - include specific strategies, frameworks, tactics, and examples that relate to the user's query. Do not try to coach or provide personal advice - just extract and organize the relevant information clearly.`
            },
            {
              role: "user", 
              content: searchQuery
            }
          ],
          tools: [{
            type: "file_search",
            vector_store_ids: [process.env.OPENAI_VECTOR_STORE_ID || "vs_67df294659c48191bffbe978d27fc6f7"],
            max_num_results: 8
          }],
          include: ["file_search_call.results"],
          stream: false
        });

        // Extract the knowledge base information
        let knowledgeBaseInfo = "";
        if (vectorSearchResponse.output) {
          for (const item of vectorSearchResponse.output) {
            if (item.type === 'message' && item.content) {
              for (const contentItem of item.content) {
                if (contentItem.type === 'output_text' && contentItem.text) {
                  knowledgeBaseInfo += contentItem.text;
                }
              }
            }
          }
        }

        console.log('[CHAT_API_DEBUG] Step 1 complete: Retrieved knowledge base info length:', knowledgeBaseInfo.length);

        // STEP 1.5: Tool Suggestion Analysis (for verbal guidance only)
        console.log('[CHAT_API_DEBUG] Step 1.5: Analyzing for tool suggestion opportunities');
        
        const toolSuggestionResponse = await openai.chat.completions.create({
          model: OPENAI_MODEL,
          messages: [
            {
              role: "system",
              content: `You are an intelligent assistant that analyzes user questions to determine if they would benefit from knowing about specific tools available in the app.

AVAILABLE TOOLS TO MENTION:
1. HYBRID OFFER CREATOR - This tool creates a complete, customized offer document for users. Mention when users ask about:
   - Creating, building, or structuring an offer
   - Pricing strategy or pricing structure  
   - Package deals or bundling services
   - Monetizing their expertise
   - Converting their service into a product
   - Creating leverage in their business model
   - "How should I price..." or "What should I charge..."
   - Problems with one-to-one vs one-to-many models
   - Creating scalable revenue streams

2. WORKSHOP GENERATOR - This tool creates a complete workshop landing page for users. Mention when users ask about:
   - Creating workshops, webinars, or training sessions
   - Teaching or educating their audience
   - Group training or group sessions  
   - Building educational content
   - Creating lead magnets through education
   - "I want to teach..." or "How do I create a workshop..."
   - Structuring learning experiences

3. DAILY CLIENT MACHINE BUILDER - This tool creates a complete DCM funnel system with copy for all 8 pages. Mention when users ask about:
   - Building a complete funnel system
   - Creating both low-ticket and high-ticket offers
   - Setting up a product ladder or value ladder
   - Generating clients AND customers daily
   - Building a dual-mode funnel
   - Creating VSLs or Big Idea videos
   - Setting up membership or community offers
   - "How do I build a funnel..." or "I need a complete system..."
   - Scaling their business with automated funnels

GUIDELINES:
- Only suggest tools when the user's question is DIRECTLY related to creating these specific things
- Don't suggest tools for general business advice that mentions these topics
- If they're asking broad strategy questions, coaching is more appropriate
- The tool should be mentioned naturally in coaching, not as the primary focus

Analyze this conversation:
Recent messages: ${messages.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n')}

Return JSON: { "shouldMention": boolean, "toolName": string|null, "reasoning": string }`
            },
            {
              role: "user",
              content: latestUserMessage
            }
          ],
          temperature: 0.3,
          response_format: { type: "json_object" }
        });

        const suggestionAnalysis = JSON.parse(toolSuggestionResponse.choices[0].message.content);
        console.log('[CHAT_API_DEBUG] Tool suggestion analysis:', suggestionAnalysis);

        // STEP 2: Process the information through James' coaching lens
        console.log('[CHAT_API_DEBUG] Step 2: Processing through James coaching lens');
        
        const JAMES_COACHING_SYSTEM = `You are James Kemp, a British business strategist who helps consultants, coaches, and service providers build highly leveraged businesses.

PERSONALITY & TONE:
- Conversational, punchy, and energetic
- Dry humor and occasional light profanity when it feels natural (not forced)
- Confident but human, blunt yet empathetic
- Philosophical yet tactical—zoom between execution and worldview
- Truth-focused, no fluff or corporate jargon

CORE PRINCIPLES (weave naturally into advice, don't list):
• Leverage > hustle
• One-to-many models over one-to-one
• Offers should solve old problems in new ways
• Don't sell "clarity" or "confidence"—sell mechanisms and outcomes
• Business should feed life, not consume it

SIGNATURE PHRASES (use sparingly, max 1-2 per response, only when they fit naturally):
• "Let me be blunt..."
• "This isn't about the thing, it's about how people feel about the thing."
• "The fastest way to get rich is also the fastest way to burn out."
• "Don't sell the seat on the plane—sell the destination."
• "It's not that it's hard—it's just harder for people who haven't done the Reps."

TOOL MENTIONS: ${suggestionAnalysis.shouldMention ? `
The user's question relates to our ${suggestionAnalysis.toolName}. You should:
1. Answer their question with your coaching insights first
2. Naturally mention that we have a specialized tool for this
3. Briefly explain what the tool does and where to find it (sidebar)
4. Don't make the tool the focus - keep coaching as primary

Example: "...and speaking of pricing strategy, we actually have a specialized Hybrid Offer Creator tool in the sidebar that will create a complete, customized offer document for you. But let me give you the strategic thinking first..."` : `
Focus on coaching their specific situation using the knowledge base information.`}

RESPONSE GUIDELINES:
- Keep responses conversational and coaching-focused, NOT encyclopedic
- Use knowledge base info as supporting material, filter through your lens
- Speak directly to one person
- Challenge assumptions when helpful
- Always end with a coaching question or next step
- Be practical and actionable, not theoretical
- Vary your language and avoid repetitive phrases
- If mentioning tools, do it naturally within the coaching context

${coachingContext}

The user's conversation history and knowledge base research are provided below.${profileContext}`;

        // Create the coaching conversation with context
        const coachingMessages = [
          { role: "system", content: JAMES_COACHING_SYSTEM },
          { role: "system", content: "Brevity Directive: Reply in **no more than 3 sentences (~80 words)**. If a tool is relevant, mention it in the first or second sentence. End with one short coaching question. No bullet lists or headings." },
          { role: "user", content: `Here's our conversation so far:\n\n${messages.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n\n')}\n\nRelevant information from knowledge base:\n${knowledgeBaseInfo}\n\n${suggestionAnalysis.shouldMention ? `TOOL MENTION OPPORTUNITY: Consider mentioning the ${suggestionAnalysis.toolName} tool. Reasoning: ${suggestionAnalysis.reasoning}` : 'Provide coaching based on their question using the knowledge base information.'}\n\nRespond as James, coaching them on their specific situation.` }
        ];

        const coachingResponse = await openai.chat.completions.create({
          model: OPENAI_MODEL,
          messages: coachingMessages,
          temperature: 0.8, // Higher temperature for more personality
          max_tokens: 220 // Force very concise responses
        });

        const responseText = coachingResponse.choices[0].message.content;
        
        console.log('[CHAT_API_DEBUG] Step 2 complete: Generated James-style response');
        console.log('[CHAT_API_DEBUG] Tool mentioned:', suggestionAnalysis.shouldMention ? suggestionAnalysis.toolName : 'None');

        // Save the response to the database
        if (chatId && supabase) {
          try {
            const msgObj = { 
              thread_id: chatId, 
              role: 'assistant', 
              content: responseText, 
              timestamp: new Date().toISOString(), 
              user_id: userId 
            };
            const { data: savedMsg, error: saveError } = await supabase
              .from('messages')
              .insert(msgObj)
              .select()
              .single();
              
            if (saveError) {
              console.error('[CHAT_API_DEBUG] Error saving message:', saveError);
            } else {
              console.log('[CHAT_API_DEBUG] Message saved:', { id: savedMsg?.id });
              
              // STEP 3: Check if we should trigger a session summary
              const messageCount = await getMessageCount(chatId);
              console.log('[CHAT_API_DEBUG] Current message count for thread:', messageCount);
              
              // Trigger session summary every 8-10 messages (when count is divisible by 9)
              if (messageCount > 0 && messageCount % 9 === 0) {
                console.log('[CHAT_API_DEBUG] Triggering session summary (message count:', messageCount, ')');
                createSessionSummary(chatId, userId).catch(err => {
                  console.error('[CHAT_API_DEBUG] Session summary failed:', err);
                });
              }
            }
          } catch (dbError) {
            console.error('[CHAT_API_DEBUG] DB error saving message:', dbError);
          }
        }

        // Return the response directly
        return NextResponse.json({
          message: responseText,
          chatId: chatId
        });

      } catch (error) {
        console.error('[CHAT_API_DEBUG] Error with 2-step coaching process:', error);
        return NextResponse.json({ 
          error: `Sorry, an error occurred: Error with coaching process: ${error.message}`, 
          chatId 
        }, { status: 500 });
      }
    } else { 
      console.log(`[CHAT_API_DEBUG] Calling OpenAI for generic tool: ${tool}`);
      const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL, 
        messages: messages, 
        temperature: 0.7
      });
      determinedAiResponseContent = completion.choices[0].message.content;
      // Remove citation/reference notations like 【6:6†source】 from the response
      if (typeof determinedAiResponseContent === 'string') {
        determinedAiResponseContent = determinedAiResponseContent.replace(/【\d+:\d+†source】/g, '').replace(/\s{2,}/g, ' ').trim();
      } else {
        determinedAiResponseContent = JSON.stringify(determinedAiResponseContent);
      }
      console.log('[CHAT_API_DEBUG] Generic tool OpenAI response received.');
    }

    // SECTION 3: Save the assistant's response to the database
    if (typeof determinedAiResponseContent !== 'undefined' && chatId && supabase) {
      console.log('[CHAT_API_DEBUG] Preparing to save assistant message to DB.');
      let contentToSaveForDB = determinedAiResponseContent;

      // Check for exact duplicate messages (only for longer messages to avoid false positives)
      let shouldCheckDuplicate = contentToSaveForDB.length > 100;
      let existingAsstMsg = [];
      
      if (shouldCheckDuplicate) {
        const { data: duplicateCheck, error: asstMsgCheckErr } = await supabase
          .from('messages')
          .select('id')
          .eq('thread_id', chatId)
          .eq('content', contentToSaveForDB)
          .eq('role', 'assistant')
          .limit(1);
        
        if (asstMsgCheckErr) {
          console.error('[CHAT_API_DEBUG] Error checking existing asst message:', asstMsgCheckErr);
        } else {
          existingAsstMsg = duplicateCheck || [];
        }
      }
      
      if (!shouldCheckDuplicate || existingAsstMsg.length === 0) {
        const msgObj = { 
          thread_id: chatId, 
          role: 'assistant', 
          content: contentToSaveForDB, 
          timestamp: new Date().toISOString(), 
          user_id: userId 
        };
        const { data: savedMsg, error: saveError } = await supabase
          .from('messages')
          .insert(msgObj)
          .select()
          .single();
          
        if (saveError) {
          console.error('[CHAT_API_DEBUG] Error saving asst message:', saveError);
        } else {
          console.log('[CHAT_API_DEBUG] Asst message saved:', { 
            id: savedMsg?.id, 
            contentLength: contentToSaveForDB.length,
            tool: tool || 'regular-chat'
          });
        }
      } else {
        console.log('[CHAT_API_DEBUG] Asst message already exists, skipping save.', {
          contentLength: contentToSaveForDB.length,
          tool: tool || 'regular-chat'
        });
      }

      if (tool === 'hybrid-offer' && toolResponsePayload) {
        console.log('[CHAT_API_DEBUG] Updating thread metadata for hybrid-offer (after saving message):', {
          chatId,
          questionsAnswered: toolResponsePayload.questionsAnswered,
          currentQuestionKey: toolResponsePayload.currentQuestionKey,
          isComplete: toolResponsePayload.isComplete,
          collectedAnswersCount: Object.keys(toolResponsePayload.collectedAnswers || {}).length 
        });
        const { error: threadUpdateError } = await supabase
          .from('threads')
          .update({
            metadata: {
              currentQuestionKey: toolResponsePayload.currentQuestionKey,
              questionsAnswered: toolResponsePayload.questionsAnswered,
              isComplete: toolResponsePayload.isComplete,
              collectedAnswers: toolResponsePayload.collectedAnswers 
            }
          })
          .eq('id', chatId);
        if (threadUpdateError) {
          console.error('[CHAT_API_DEBUG] Error updating thread metadata:', threadUpdateError);
        } else {
          console.log('[CHAT_API_DEBUG] Thread metadata updated successfully');
          
          // Capture tool memory when offer is complete
          if (toolResponsePayload.isComplete && toolResponsePayload.collectedAnswers) {
            console.log('[CHAT_API_DEBUG] Hybrid offer complete - creating tool memory summary');
            createToolMemorySummary(userId, chatId, 'hybrid-offer', toolResponsePayload.collectedAnswers).catch(err => {
              console.error('[CHAT_API_DEBUG] Hybrid offer memory capture failed:', err);
            });
          }
        }
      }

      if (tool === 'workshop-generator' && toolResponsePayload) {
        console.log('[CHAT_API_DEBUG] Updating thread metadata for workshop generator (after saving message):', {
          chatId,
          questionsAnswered: toolResponsePayload.questionsAnswered,
          currentQuestionKey: toolResponsePayload.currentQuestionKey,
          isComplete: toolResponsePayload.isComplete,
          collectedAnswersCount: Object.keys(toolResponsePayload.collectedAnswers || {}).length 
        });
        const { error: threadUpdateError } = await supabase
          .from('threads')
          .update({
            metadata: {
              currentQuestionKey: toolResponsePayload.currentQuestionKey,
              questionsAnswered: toolResponsePayload.questionsAnswered,
              isComplete: toolResponsePayload.isComplete,
              collectedAnswers: toolResponsePayload.collectedAnswers 
            }
          })
          .eq('id', chatId);
        if (threadUpdateError) {
          console.error('[CHAT_API_DEBUG] Error updating thread metadata:', threadUpdateError);
        } else {
          console.log('[CHAT_API_DEBUG] Thread metadata updated successfully for workshop generator');
          
          // Capture tool memory when workshop is complete
          if (toolResponsePayload.isComplete && toolResponsePayload.collectedAnswers) {
            console.log('[CHAT_API_DEBUG] Workshop complete - creating tool memory summary');
            createToolMemorySummary(userId, chatId, 'workshop-generator', toolResponsePayload.collectedAnswers).catch(err => {
              console.error('[CHAT_API_DEBUG] Workshop memory capture failed:', err);
            });
          }
        }
      }

      if (tool === 'daily-client-machine' && toolResponsePayload) {
        console.log('[CHAT_API_DEBUG] Updating thread metadata for daily-client-machine (after saving message):', {
          chatId,
          questionsAnswered: toolResponsePayload.questionsAnswered,
          currentQuestionKey: toolResponsePayload.currentQuestionKey,
          isComplete: toolResponsePayload.isComplete,
          collectedAnswersCount: Object.keys(toolResponsePayload.collectedAnswers || {}).length 
        });
        const { error: threadUpdateError } = await supabase
          .from('threads')
          .update({
            metadata: {
              currentQuestionKey: toolResponsePayload.currentQuestionKey,
              questionsAnswered: toolResponsePayload.questionsAnswered,
              isComplete: toolResponsePayload.isComplete,
              collectedAnswers: toolResponsePayload.collectedAnswers,
              copyGenerated: toolResponsePayload.copyGenerated || false
            }
          })
          .eq('id', chatId);
        if (threadUpdateError) {
          console.error('[CHAT_API_DEBUG] Error updating thread metadata:', threadUpdateError);
        } else {
          console.log('[CHAT_API_DEBUG] Thread metadata updated successfully for daily-client-machine');
          
          // Capture tool memory when DCM is complete
          if (toolResponsePayload.isComplete && toolResponsePayload.collectedAnswers) {
            console.log('[CHAT_API_DEBUG] DCM complete - creating tool memory summary');
            createToolMemorySummary(userId, chatId, 'daily-client-machine', toolResponsePayload.collectedAnswers).catch(err => {
              console.error('[CHAT_API_DEBUG] DCM memory capture failed:', err);
            });
          }
        }
      }
    }

    // SECTION 4: Prepare the final response to send to the client
    let finalResponsePayload;
    if (toolResponsePayload) {
        finalResponsePayload = toolResponsePayload;
    } else if (typeof determinedAiResponseContent !== 'undefined') {
        finalResponsePayload = {
            message: determinedAiResponseContent,
            currentQuestionKey: body.currentQuestionKey || null,
            collectedAnswers: { ...collectedAnswers },
            questionsAnswered: calculateQuestionsAnswered(collectedAnswers, tool),
            isComplete: false,
            chatId: chatId
        };
    } else {
        console.error('[CHAT_API_DEBUG] Critical: No response determined. Fallback.');
        finalResponsePayload = {
            message: "An error occurred processing your request.",
            currentQuestionKey: body.currentQuestionKey || null,
            collectedAnswers: { ...collectedAnswers },
            questionsAnswered: calculateQuestionsAnswered(collectedAnswers, tool),
            isComplete: false,
            chatId: chatId,
            error: true
        };
    }

    console.log('[CHAT_API_DEBUG] Sending final response to client:', { chatId: finalResponsePayload.chatId, msgPreview: finalResponsePayload.message?.substring(0,50) });
    return NextResponse.json(finalResponsePayload);

  } catch (error) {
    console.error('[CHAT_API_DEBUG] Unhandled error in API route:', { msg: error.message, stack: error.stack });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
  }
}

// Helper function to check if a string is a valid UUID
function isValidUUID(id) {
  if (!id) return false;
  
  // UUID v4 pattern
  const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidV4Pattern.test(id);
}

// Function to extract text from assistant message
function extractTextFromAssistantMessage(message) {
  if (!message || !message.content || !Array.isArray(message.content)) {
    return null;
  }

  // Look for text content in the message
  for (const contentItem of message.content) {
    if (contentItem.type === "output_text" && contentItem.text) {
      return contentItem.text;
    }
  }

  return null;
}

// Function to process file search results
function processFileSearchResults(fileSearchCall) {
  if (!fileSearchCall || !fileSearchCall.results || !Array.isArray(fileSearchCall.results)) {
    return [];
  }
  
  // Map the results to extract text and metadata
  return fileSearchCall.results
    .map(result => {
      if (result.text) {
        return {
          text: result.text,
          source: result.file?.name,
          page: result.file?.page_number
        };
      }
      return null;
    })
    .filter(Boolean); // Remove any null results
} 