import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { TOOLS } from '@/lib/config/tools';
import { v4 as uuidv4 } from 'uuid';
import { getUserProfile } from '@/lib/utils/supabase';
import { buildProfileContext } from '@/lib/utils/ai';
import { saveMemory, searchMemories } from '@/lib/utils/memory';

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

// Helper to embed text using OpenAI
async function embedText(text) {
  if (!text) return null;
  try {
    const embedRes = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text
    });
    return embedRes.data[0]?.embedding || null;
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('[CHAT_API_DEBUG] Error creating embedding:', err);
    return null;
  }
}

// Define the questions and their corresponding keys, in order
const hybridOfferQuestions = [
  { 
    key: 'offerDescription', 
    question: "What's your core product or service?",
    description: "Core product or service"
  },
  { 
    key: 'targetAudience', 
    question: "Who is your target audience?",
    description: "Target audience details"
  },
  { 
    key: 'painPoints', 
    question: "What pain points do they face?",
    description: "Customer pain points"
  },
  { 
    key: 'solution', 
    question: "How do you solve these problems?",
    description: "Solution approach"
  },
  { 
    key: 'pricing', 
    question: "What's your pricing structure?",
    description: "Pricing information"
  },
  { 
    key: 'clientResult', 
    question: "What's a specific, real-world result you've helped a client achieve?",
    description: "Specific client success story"
  }
];

// Define the workshop generator questions
const workshopQuestions = [
  { 
    key: 'participantOutcomes', 
    question: "What specific outcomes or goals will participants achieve by the end of your workshop?",
    description: "Participant outcomes and goals"
  },
  { 
    key: 'targetAudience', 
    question: "Who is your ideal workshop participant? Please describe their demographics, current situation, and main pain points.",
    description: "Target audience demographics and pain points"
  },
  { 
    key: 'problemAddressed', 
    question: "What specific problem or challenge does your workshop solve for these participants?",
    description: "Problem the workshop addresses"
  },
  { 
    key: 'workshopDuration', 
    question: "How long will your workshop be? Please specify the duration and format.",
    description: "Workshop duration and format"
  },
  { 
    key: 'topicsAndActivities', 
    question: "What key topics will you cover and what activities will participants engage in during the workshop?",
    description: "Topics covered and activities"
  },
  { 
    key: 'resourcesProvided', 
    question: "What resources, materials, or follow-up support will participants receive?",
    description: "Resources and materials provided"
  }
];

// Add a function to validate answers using AI
async function validateHybridOfferAnswer(questionKey, answer) {
  if (!answer || answer.trim().length < 3) {
    return {
      isValid: false,
      reason: "The answer is too short to provide meaningful information."
    };
  }

  // For offerDescription, if the answer is short (e.g., just a service name),
  // consider it valid without extensive AI validation.
  if (questionKey === 'offerDescription' && answer.trim().length < 50 && answer.trim().split(' ').length <= 5) {
    console.log(`[Chat API] Skipping extensive AI validation for short offerDescription: "${answer}"`);
    return { isValid: true, reason: null, topic: "service description" };
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
  
  const validationCriteria = {
    offerDescription: "Should describe a product or service. It can be a concise name (e.g., 'Web Design Service') or a more detailed explanation. Must focus on WHAT is being offered, not pricing or audience.",
    targetAudience: "Should describe who the offering is for - demographics, professions, or characteristics. Must focus on WHO the clients are, not what they're charged or the problems they have.",
    painPoints: "Should identify problems or challenges that the target audience experiences. Must focus on PROBLEMS clients face, not solutions or pricing.",
    solution: "Should explain how the product/service addresses the pain points in a unique way. Must focus on HOW problems are solved, not pricing or audience.",
    pricing: "Should provide information about pricing structure, tiers, or general price range. Must focus on COSTS or pricing models, not other aspects.",
    clientResult: "Should describe any client success, outcome, or result. Can be very brief (e.g., 'made a client $1M', 'helped increase sales'). ANY mention of helping clients achieve something positive is valid."
  };

  const validationPrompt = [
    {
      role: "system",
      content: `You are an assistant that validates answers for creating a hybrid offer.
Your primary goal is to determine if an answer provides relevant and SUFFICIENT information for the SPECIFIC question being asked.
Be strict about topic relevance - if someone answers about pricing when asked about solution approach, that's invalid.
Check that the answer addresses the core of what's being asked, not just tangentially related information.
If the answer discusses a different aspect of the business than what was asked, mark it as invalid.
For 'offerDescription', a concise service name (e.g., 'Career Coaching', 'Airbnb Revenue Management') IS a valid and sufficient answer.
For 'clientResult', be EXTREMELY LENIENT. ANY mention of helping a client, achieving a result, or positive outcome should be marked as valid. Examples of valid answers: 'made a client $1M', 'helped increase their sales', 'improved their revenue', 'we helped one company make extra money', 'increased leads for clients'. Do NOT require detailed explanations of HOW the result was achieved.
Example of invalid answer: Question about unique solution approach → Answer about pricing structure.`
    },
    {
      role: "user",
      content: `Question category: ${questionKey}\nValidation criteria: ${validationCriteria[questionKey]}\nUser's answer: "${answer}"\n\nIs this answer directly relevant to the question category? Does it address what was specifically asked according to the criteria?\nFocus on whether the user's answer *directly addresses* the question's core intent.\nReturn JSON in this format: { "isValid": boolean, "reason": "explanation if invalid", "topic": "what topic the answer actually addresses" }`
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
  const questionsArray = tool === 'workshop-generator' ? workshopQuestions : hybridOfferQuestions;
  
  // Count how many of the predefined questions have answers
  let count = 0;
  for (const question of questionsArray) {
    if (collectedAnswers[question.key] && collectedAnswers[question.key].trim().length > 0) {
      count++;
    }
  }
  
  return count;
}

// Add this function to generate appropriate thread titles
function generateThreadTitle(message) {
  if (!message || !message.content) {
    return "New conversation";
  }
  
  // Truncate and clean the message to create a title
  const maxLength = 30;
  let title = message.content.trim();
  
  // Remove any newlines or extra whitespace
  title = title.replace(/\s+/g, ' ');
  
  if (title.length > maxLength) {
    // Cut at the last complete word within maxLength
    title = title.substr(0, maxLength).split(' ').slice(0, -1).join(' ') + '...';
  }
  
  console.log('[Chat API] Generated title from message:', {
    original: message.content.substring(0, 50) + (message.content.length > 50 ? '...' : ''),
    generated: title
  });
  
  return title || "New conversation";
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
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name) { return cookieStore.get(name)?.value; },
          set(name, value, options) { cookieStore.set({ name, value, ...options }); },
          remove(name, options) { cookieStore.set({ name, value: '', ...options }); },
        },
      }
    );

    // Get the authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    let userId = user?.id;

    // Fetch profile information for authenticated users
    let userProfile = null;
    if (userId) {
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('full_name, occupation, desired_mrr, desired_hours')
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

    // Memory summary retrieval and profile context generation
    let memorySummary = null;
    if (userId) {
      try {
        const { data: memData, error: memError } = await supabase
          .from('memory_summaries')
          .select('summary')
          .eq('user_id', userId)
          .single();
        if (!memError && memData?.summary) {
          memorySummary = memData.summary;
        } else if (memError && process.env.NODE_ENV !== 'production') {
          console.error('[CHAT_API_DEBUG] Error fetching memory summary:', memError);
        }
      } catch (memEx) {
        if (process.env.NODE_ENV !== 'production') console.error('[CHAT_API_DEBUG] Exception fetching memory summary:', memEx);
      }
    }

    const profileContext = await buildProfileContext(userProfile);

    // (Optional) Combined profile summary – currently unused but kept for future use
    const profileSummaryParts = [];
    if (memorySummary) profileSummaryParts.push(memorySummary);
    if (userProfile?.full_name) profileSummaryParts.push(userProfile.full_name);
    if (userProfile?.occupation) profileSummaryParts.push(`Occupation: ${userProfile.occupation}`);
    if (userProfile?.desired_mrr) profileSummaryParts.push(`Desired MRR: ${userProfile.desired_mrr}`);
    if (userProfile?.desired_hours) profileSummaryParts.push(`Desired hours: ${userProfile.desired_hours}`);
    const profileSummary = profileSummaryParts.join(', ');

    // Handle anonymous users more gracefully
    if (!userId) {
      if (process.env.ALLOW_ANONYMOUS_CHATS === 'true' || process.env.NODE_ENV === 'development') {
        // Generate a proper UUID for anonymous users for database compatibility
        userId = uuidv4();
        console.log('[CHAT_API_DEBUG] Anonymous chat allowed, using generated UUID:', userId);
      } else {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
    }

    const userQuestion = body.userQuestion || '';
    if (userQuestion) {
      const embedding = await embedText(userQuestion);
      const memoryMatches = await searchMemories(userId, embedding);
      const relevantSnippets = (memoryMatches || []).filter(m => m.similarity > 0.8);
      if (relevantSnippets.length > 0) {
        relevantSnippets.forEach(snippet => {
          const text = snippet.snippet || snippet.content || snippet.text || '';
          if (text) messages.push({ role: 'system', content: text });
        });
      }
    }

    // SECTION 1: Handle tool initialization (especially for hybrid-offer)
    if (isToolInit && tool === 'hybrid-offer') {
      const initialSystemPrompt = `You are creating a hybrid offer for businesses. (concise prompt details...)${profileContext}`;
      const initialMessage = "What's your core product or service?";
      const existingAnswers = body.collectedAnswers || {};
      const questionsAnsweredOnInit = calculateQuestionsAnswered(existingAnswers);
      
      // Note: chatId here is the one from the client, which might be temporary.
      // The API will generate a permanent UUID if clientChatId was not a valid UUID.
      // We need to use the *final* chatId (permanent UUID) for DB operations.
      const finalChatIdForDB = isValidUUID(clientChatId) ? clientChatId : chatId; // chatId is already the potentially new UUID

      const initialMetadataForDB = {
        currentQuestionKey: 'offerDescription',
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
            ? { currentQuestionKey: 'offerDescription', questionsAnswered: 0, isComplete: false } 
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
      currentQuestionKey = body.currentQuestionKey || 'offerDescription';
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
      const currentQuestionText = currentQuestionDetails?.question || 'this aspect of your offer';

      let promptParts = [];
      promptParts.push("You are a friendly and cheeky helpful AI assistant guiding a user through creating a 'hybrid offer'. Your goal is to gather specific pieces of information by asking questions in a conversational manner.");
      promptParts.push("Your tone should be friendly, funny when appropriate, conversational, and engaging. Adapt your language based on the user's style in the chat history.");

      promptParts.push(`\nInformation collected so far for the hybrid offer (${currentQuestionsAnswered}/${totalQuestions} questions answered):`);
      hybridOfferQuestions.forEach((q, index) => {
        if (collectedAnswers[q.key]) {
          promptParts.push(`✓ ${index + 1}. ${q.description}: Answered`); // Don't show the answer itself to keep prompt shorter
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
            - targetAudience: "Small business owners who don't have time for marketing"
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
      promptParts.push(`   - If validAnswer is true AND isComplete is false: Determine the *key* of the *next* unanswered question from this list: ${hybridOfferQuestions.map(q => q.key).join(", ")}. The next question should be the first one in the sequence that hasn't been answered yet.`);
      promptParts.push(`   - If validAnswer is false: This should be the *current* currentQuestionKey (${currentQuestionKey}), as we need to re-ask or clarify.`);
      promptParts.push(`   - If isComplete is true: This can be null.`);
      promptParts.push(`5. responseToUser (string): This is your natural language response to the user. It will be shown directly to them.`);
      promptParts.push(`   - If validAnswer was true and isComplete is false: Briefly acknowledge their answer for '${currentQuestionDescription}'. Then, conversationally transition to ask about the topic of the nextQuestionKey. Refer to the chat history if it helps make your response more contextual.`);
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
          const validationResult = await validateHybridOfferAnswer(currentQuestionKey, latestUserMessage);
          
          if (!validationResult.isValid) {
            console.log(`[CHAT_API_DEBUG] Answer validation failed for '${currentQuestionKey}': ${validationResult.reason}`);
            
            // If the answer is completely off-topic, we'll generate a direct but kind response
            const invalidAnswerResponse = `I notice you're sharing about ${validationResult.topic || 'something different'}, which is valuable information! However, I'm currently asking about your ${hybridOfferQuestions.find(q => q.key === currentQuestionKey)?.description || currentQuestionKey}. Could you tell me more specifically about that?`;
            
            // Create response payload without advancing to next question
            toolResponsePayload = {
              message: invalidAnswerResponse,
              currentQuestionKey: currentQuestionKey, // Stay on current question
              collectedAnswers: { ...collectedAnswers }, // Keep existing answers
              questionsAnswered: calculateQuestionsAnswered(collectedAnswers),
              isComplete: false,
              chatId: chatId
            };
            
            // Return early with this simple validation response
            console.log('[CHAT_API_DEBUG] Returning early with validation failure response');
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
        promptParts.push(`   - If validAnswer was true and isComplete is true: Acknowledge that all information has been gathered. Say "Perfect! I have all the information needed to create your workshop landing page. I'm now generating your complete HTML landing page that you can paste directly into GoHighLevel." Then include this exact placeholder: <!-- GENERATE_WORKSHOP_HTML_NOW --> After the placeholder, provide the detailed GoHighLevel instructions and mention that they can ask for design changes anytime.`);
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
              `\n\n\`\`\`html\n${generatedHTML}\n\`\`\`\n\n**Instructions:**\n1. Copy the HTML code above\n2. In HighLevel, go to Sites → Pages → Create New Page\n3. Choose "Custom Code" or "Blank Page"\n4. Paste the HTML code into the custom code section\n5. Save and publish your landing page\n\n**Want to make changes?** Just tell me what you'd like to modify! For example:\n- "Make the background darker"\n- "Change the colors to blue and white"\n- "Make it look more professional"\n- "Add more spacing between sections"\n\nI'll regenerate the HTML with your requested changes instantly!`
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
    } else if (!tool) {
      console.log('[CHAT_API_DEBUG] Using 2-step coaching process for regular chat');
      try {
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
              
              // Trigger memory classification for regular chat
              try {
                console.log('[CHAT_API_DEBUG] Triggering memory classification for regular chat');
                await classifyAndSaveMemory(responseText, chatId, userId);
                console.log('[CHAT_API_DEBUG] Memory classification completed for regular chat');
              } catch (memErr) {
                console.error('[CHAT_API_DEBUG] Memory classification failed for regular chat:', memErr.message, memErr.stack);
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

      const { data: existingAsstMsg, error: asstMsgCheckErr } = await supabase.from('messages').select('id').eq('thread_id', chatId).eq('content', contentToSaveForDB).eq('role', 'assistant').limit(1);
      if (asstMsgCheckErr) console.error('[CHAT_API_DEBUG] Error checking existing asst message:', asstMsgCheckErr);
      
      if (!existingAsstMsg || existingAsstMsg.length === 0) {
        const msgObj = { thread_id: chatId, role: 'assistant', content: contentToSaveForDB, timestamp: new Date().toISOString(), user_id: userId };
        const { data: savedMsg, error: saveError } = await supabase.from('messages').insert(msgObj).select().single();
        if (saveError) console.error('[CHAT_API_DEBUG] Error saving asst message:', saveError); else console.log('[CHAT_API_DEBUG] Asst message saved:', { id: savedMsg?.id });
      } else {
        console.log('[CHAT_API_DEBUG] Asst message already exists, skipping save.');
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
        }
      }

      // Start non-blocking memory classification with better error logging
      console.log(`[CHAT_API_DEBUG] Attempting to call classifyAndSaveMemory. Params: contentToSaveForDB (length: ${contentToSaveForDB?.length}), chatId: ${chatId}, userId: ${userId}`);
      console.log(`[CHAT_API_DEBUG] ENV CHECK BEFORE CALL: OPENAI_API_KEY present: ${!!process.env.OPENAI_API_KEY}, SUPABASE_SERVICE_ROLE_KEY present: ${!!process.env.SUPABASE_SERVICE_ROLE_KEY}`);
      
      if (contentToSaveForDB && chatId && userId) {
        try {
          console.log('[CHAT_API_DEBUG] AWAITING classifyAndSaveMemory (debug build)');
          await classifyAndSaveMemory(contentToSaveForDB, chatId, userId);
          console.log('[CHAT_API_DEBUG] classifyAndSaveMemory completed without throwing');
        } catch (err) {
          console.error('[CHAT_API_DEBUG] Memory classification failed (await path):', err.message, err.stack);
          console.error(`[CHAT_API_DEBUG] ENV CHECK INSIDE CATCH BLOCK: OPENAI_API_KEY present: ${!!process.env.OPENAI_API_KEY}, SUPABASE_SERVICE_ROLE_KEY present: ${!!process.env.SUPABASE_SERVICE_ROLE_KEY}`);
        }
      } else {
        console.error('[CHAT_API_DEBUG] Skipped calling classifyAndSaveMemory due to missing parameters.');
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

// Analyze assistant text and store as memory without blocking the response
export async function classifyAndSaveMemory(text, threadId, userId) {
  console.log(`[CHAT_API_DEBUG] Entered classifyAndSaveMemory. Args: text (length: ${text?.length}), threadId: ${threadId}, userId: ${userId}`);
  console.log(`[CHAT_API_DEBUG] ENV CHECK AT START OF classifyAndSaveMemory: OPENAI_API_KEY present: ${!!process.env.OPENAI_API_KEY}, SUPABASE_SERVICE_ROLE_KEY present: ${!!process.env.SUPABASE_SERVICE_ROLE_KEY}`);
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('[CHAT_API_DEBUG] CRITICAL: OPENAI_API_KEY is missing in classifyAndSaveMemory. Aborting.');
    return;
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[CHAT_API_DEBUG] CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing in classifyAndSaveMemory. Aborting.');
    return;
  }
  if (!text || !threadId || !userId) {
    console.error('[CHAT_API_DEBUG] CRITICAL: Missing text, threadId, or userId in classifyAndSaveMemory. Aborting.');
    return;
  }

  try {
    console.log('[CHAT_API_DEBUG] Starting memory classification for user:', userId);
    
    const classificationPrompt = [
      { role: 'system', content: 'Decide if the following assistant message should be saved as a memory. Return JSON {"should_write_memory": boolean, "memory_type": "short type"}. Use "general" if unsure.' },
      { role: 'user', content: text }
    ];
    const cls = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: classificationPrompt,
      temperature: 0,
      response_format: { type: 'json_object' }
    });
    const result = JSON.parse(cls.choices[0].message.content || '{}');
    console.log('[CHAT_API_DEBUG] Memory classification result:', result);
    
    if (!result.should_write_memory) {
      console.log('[CHAT_API_DEBUG] AI decided not to save this message as memory');
      return;
    }

    console.log('[CHAT_API_DEBUG] Creating embedding for memory...');
    const embed = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text
    });
    const embedding = embed.data[0]?.embedding;
    if (!embedding) {
      console.log('[CHAT_API_DEBUG] Failed to create embedding');
      return;
    }

    console.log('[CHAT_API_DEBUG] Saving memory to database...');
    await saveMemory({
      userId,
      threadId,
      content: text,
      embedding,
      type: result.memory_type || 'general'
    });
    console.log('[CHAT_API_DEBUG] Memory saved successfully!');
  } catch (err) {
    console.error('[CHAT_API_DEBUG] Memory classification failed (error caught within classifyAndSaveMemory):', err.message, err.stack);
  }
}
