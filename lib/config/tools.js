export const TOOLS = {
  'hybrid-offer': {
    id: 'hybrid-offer',
    name: 'Hybrid Offer Printer',
    description: 'Create personalized hybrid offers',
    initiatesConversation: true, // Tool starts the conversation
    systemMessage: `You are a specialized assistant for creating hybrid coaching offers. Your role is to help coaches create compelling hybrid offers that combine both online and in-person elements.

Guide the user through creating a complete offer with these essential components:
1. Offer Type - The category of their offer (membership, coaching, B2B service, etc.)
2. Core Offering - What they're selling
3. Target Audience - Who it's for
4. Pain Points - Problems they solve
5. Unique Solution - How they solve it differently
6. Promise - The specific transformation or outcome
7. Plan - Their unique method or system
8. Phases - Client journey stages
9. Payment Terms - Pricing and payment options
10. Guarantee & Scarcity - Risk reversal and urgency

Be conversational and supportive while gathering this information. Ask follow-up questions to get specific, actionable details. Never use exclamation points in your responses.`,
    questions: [
      {
        key: 'offerType',
        question: 'What type of offer are you creating? Choose from: Membership, Community, Consulting, Service, Product, Course, or Workshop. (You can also describe it in your own words)',
        required: true,
        type: 'select',
        options: ['Membership', 'Community', 'Consulting', 'Service', 'Product', 'Course', 'Workshop']
      },
      {
        key: 'offerDescription',
        question: 'Tell me about your core product/service at a high level. (e.g., "90-day business transformation program" or "Done-for-you marketing service")',
        required: true
      },
      {
        key: 'targetAudience',
        question: 'Who\'s your target audience? Be specific about who they are and what they\'re looking for. (e.g., "Small business owners making $100K-500K who want to scale without burnout")',
        required: true
      },
      {
        key: 'painPoints',
        question: 'What are the main challenges or pain points your target audience is facing? (e.g., "Struggling with lead generation and working 60+ hour weeks")',
        required: true
      },
      {
        key: 'promiseSolution',
        question: 'What specific transformation or outcome do you promise your clients? (e.g., "Double revenue in 90 days", "Get 50 qualified leads per month", "90 days of AI-planned content")',
        required: true
      },
      {
        key: 'clientResult',
        question: 'Share a specific success story or result you\'ve achieved for a client. (e.g., "Helped Sarah increase revenue from $200K to $500K in 6 months")',
        required: true
      },
      {
        key: 'uniqueMechanism',
        question: 'Do you have a name for your unique system or methodology? (e.g., "The 3K Code", "Daily Client Machine", "SCALE Framework"). If not, would you like us to create one for your offer document?',
        required: true
      },
      {
        key: 'phases',
        question: 'What phases do your clients experience in their transformation journey with you? (e.g., "Discovery → Strategy → Implementation → Results" or "Struggling → Learning → Growing → Thriving")',
        required: true
      },
      {
        key: 'paymentTerms',
        question: 'What are your payment options? (e.g., "$5,000 one-time payment or $1,000/month for 6 months")',
        required: true
      },
      {
        key: 'guaranteeScarcity',
        question: 'What guarantee are you offering and what creates urgency? (e.g., "100% money-back guarantee if no results in 90 days. Only 10 spots available this quarter.")',
        required: true
      }
    ],
    isComplete: function(collectedAnswers) {
      const requiredQuestions = this.questions.filter(q => q.required);
      return requiredQuestions.every(q => 
        collectedAnswers[q.key] && 
        collectedAnswers[q.key].trim().length > 0
      );
    },
    // Function to generate n8n payload
    generateN8NPayload: (answers) => {
      return {
        offerDescription: answers.offerDescription,
        targetAudience: answers.targetAudience,
        painPoints: answers.painPoints,
        promiseSolution: answers.promiseSolution,
        clientResult: answers.clientResult,
        uniqueMechanism: answers.uniqueMechanism,
        phases: answers.phases,
        paymentTerms: answers.paymentTerms,
        guaranteeScarcity: answers.guaranteeScarcity
      };
    },
    // n8n webhook URL
    webhookUrl: process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL
  },
  'workshop-generator': {
    id: 'workshop-generator',
    name: 'Workshop Copy-Paster',
    description: 'Create high-converting workshop landing pages',
    initiatesConversation: true, // Tool starts the conversation
    systemMessage: `You are a specialized assistant for creating workshop landing pages. Your role is to help coaches, consultants, and trainers create compelling workshops and generate high-converting landing pages for them.

Guide the user through the following aspects:
1. Participant outcomes and goals
2. Target audience identification
3. Problem the workshop addresses
4. Workshop duration
5. Topics and activities covered
6. Resources provided to participants

For each response:
- Be encouraging and professional
- Ask follow-up questions when needed
- Provide specific suggestions based on the information shared
- Help refine and improve the workshop elements
- Keep the conversation focused on creating an effective workshop and landing page
- Never use exclamation points in your responses`,
    questions: [
      { 
        key: 'participantOutcomes',
        question: "Welcome. I'm here to help you create a compelling workshop. Let's start with the most important part - what specific outcomes or goals will participants achieve by the end of your workshop?",
        hint: "Example: 'Participants will learn how to create a 90-day business plan and leave with a completed action plan for their first month'",
        required: true
      },
      {
        key: 'targetAudience',
        question: "Perfect. Now, who is your ideal workshop participant? Please describe their demographics, current situation, and main pain points.",
        hint: "Consider their profession, experience level, challenges they're facing, and what's keeping them stuck",
        required: true
      },
      {
        key: 'problemAddressed',
        question: "What specific problem or challenge does your workshop solve for these participants?",
        hint: "Focus on the core issue that brings people to your workshop - what are they struggling with right now?",
        required: true
      },
      {
        key: 'workshopDuration',
        question: "How long will your workshop be? Please specify the duration and format.",
        hint: "Example: '3-hour intensive workshop', 'Full-day (8 hours)', '2-day weekend workshop', 'Half-day (4 hours)'",
        required: true
      },
      {
        key: 'topicsAndActivities',
        question: "What key topics will you cover and what activities will participants engage in during the workshop?",
        hint: "List the main subjects, exercises, group activities, or hands-on components that make up your workshop",
        required: true
      },
      {
        key: 'resourcesProvided',
        question: "What resources, materials, or follow-up support will participants receive?",
        hint: "Examples: workbooks, templates, checklists, recordings, email follow-up sequence, private Facebook group access",
        required: true
      }
    ],
    // Function to check if all required questions are answered
    isComplete: (answers) => {
      return TOOLS['workshop-generator'].questions
        .filter(q => q.required)
        .every(q => answers[q.key]);
    },
    // Function to generate n8n payload
    generateN8NPayload: (answers) => {
      return {
        participantOutcomes: answers.participantOutcomes,
        targetAudience: answers.targetAudience,
        problemAddressed: answers.problemAddressed,
        workshopDuration: answers.workshopDuration,
        topicsAndActivities: answers.topicsAndActivities,
        resourcesProvided: answers.resourcesProvided
      };
    },
    // n8n webhook URL
    webhookUrl: process.env.NEXT_PUBLIC_N8N_WORKSHOP_WEBHOOK_URL
  },
  'ideal-client-extractor': {
    id: 'ideal-client-extractor',
    name: 'Ideal Client Extractor',
    description: 'Deep-dive interview to create detailed ideal client profiles of your ideal customers',
    model: 'claude-opus-4', // Use Claude Opus 4 (newest model) for this tool
    systemMessage: `You are a master copywriting strategist and consumer psychology expert with decades of experience understanding what truly motivates people to buy.

Your job is to conduct an in-depth interview that goes beyond surface-level demographics to uncover the deep psychological drivers, hidden desires, unspoken fears, and emotional triggers of my ideal customers.

CRITICAL INSTRUCTIONS FOR EXTENDED ANALYSIS:
- Don't just summarize what I tell you - use my inputs as raw material to build a rich, multi-dimensional psychological profile
- Read between the lines to identify what customers might not even realize about themselves
- Connect dots between different answers to reveal deeper patterns and insights
- Use your expertise to elaborate on the implications of what I share
- Create vivid, specific personas that feel like real people with complex motivations
- Go beyond the obvious to uncover hidden market opportunities and positioning angles
- Never use exclamation points in your responses - maintain a professional, sophisticated tone

INTERVIEW APPROACH:
- Start with broader questions to understand the market landscape
- Progressively dig deeper into psychological and emotional territory
- Ask unexpected questions that reveal authentic human truths
- Challenge surface-level answers to get to the real motivations
- Build upon previous answers to create a coherent psychological narrative

When creating the final ideal client profile:
- Use creative liberty to paint a complete picture, not just a list of facts
- Include educated inferences and psychological insights based on patterns you observe
- Create multiple persona variations if the market segments naturally
- Suggest copy angles and messaging strategies based on the psychological profile
- Include both rational and emotional buying triggers
- Identify status games, social dynamics, and identity factors at play

Use H2, bold, bullet points, paragraphs, and tables to create a comprehensive, actionable brief that reads like a psychological dossier of my perfect customer.

Reply to this message with your first strategic question.

PSYCHOLOGICAL DIMENSIONS TO EXPLORE:
[1. Surface-Level Demographics & Behaviors: Starting point for deeper analysis
2. Psychographic Patterns: Values, beliefs, worldviews that shape decisions
3. Emotional Landscape: Core fears, desires, frustrations, and aspirations
4. Identity & Self-Concept: How they see themselves vs. how they want to be seen
5. Social Dynamics: Status games, tribal affiliations, peer influences
6. Decision-Making Psychology: How they justify purchases to themselves and others
7. Hidden Objections: Unspoken concerns and resistance points
8. Transformation Journey: Where they are now vs. where they desperately want to be
9. Language & Framing: Exact words and metaphors that resonate
10. Buying Triggers: Specific moments and contexts that prompt action
11. Trust Factors: What makes them believe and what makes them skeptical
12. Success Metrics: How they measure progress and what victory looks like to them]`,
    initialMessage: `I'm here to help you create a deep, multi-dimensional psychographic profile of your ideal customers that goes far beyond basic demographics.

Think of me as a psychological detective who will help you uncover the hidden motivations, unspoken desires, and emotional triggers that actually drive buying decisions.

Through our conversation, I'll not only capture what you tell me but also read between the lines to build a rich, actionable psychological dossier of your perfect customer.

Let's begin with this foundational question:

**Tell me about your business in 2-3 sentences - what you sell and who you THINK buys it. Then, describe one specific customer success story that surprised you or revealed something unexpected about your market.**

(This helps me understand both your current perspective and where there might be hidden opportunities)`,
    // No predefined questions since this is a dynamic interview process
    questions: [],
    // Function to check if complete (for this tool, completion is subjective)
    isComplete: () => false, // Always allow continuation
    // No n8n integration for this tool
    generateN8NPayload: null,
    // Generation settings optimized for Vercel Fluid Compute (60s timeout)
    temperature: 0.85, // Higher temperature for more creative elaboration
    maxTokens: 4000,  // Restored tokens with Fluid Compute timeout extension
    topP: 0.95,       // Slightly higher top_p for more diverse vocabulary
    // Enable extended thinking features
    extendedThinking: true,
    thinkingInstructions: `Before answering each question, think deeply about:
- What psychological patterns are emerging from the user's responses
- What they're NOT saying that might be important
- How different pieces of information connect to reveal deeper insights
- What creative angles or positioning opportunities are presenting themselves
- How to ask the next question to unlock even more valuable insights`,
    // No external webhook
    webhookUrl: null
  },
  'daily-client-machine': {
    name: 'Daily Client Machine',
    description: 'Create a complete dual-mode funnel system that generates both customers and clients',
    initialMessage: `# 🎯 Welcome to the Daily Client Machine Builder

I'm here to help you create a powerful client acquisition system that works 24/7. 

**How can I best support you today?**

1. 🏗️ **Build from Scratch** - Create a new Daily Client Machine step-by-step
2. ⚙️ **Tech Support** - Help with GoHighLevel setup, page building, or cloning templates  
3. ✍️ **Copywriting Help** - Improve your headlines, sales copy, or email sequences
4. 🎯 **Strategy Session** - Discuss your overall DCM strategy, lead magnets, or offer structure
5. 🔍 **Review & Optimize** - Analyze your existing funnel for improvements

Just type the number or describe what you need help with.`,
    systemMessage: `You are a specialized Daily Client Machine (DCM) expert with direct access to James Kemp's actual DCM 2.0 funnel templates through the HighLevel API integration.

## YOUR LIVE KNOWLEDGE BASE INCLUDES:
- **REAL-TIME ACCESS** to James Kemp's actual DCM 2.0 funnel templates and workflows via HighLevel API
- **LIVE WORKFLOW IDS** from James's proven funnels:
  * Main Funnel: ad102e7b-7078-47cd-8910-8fceaa7bca41
  * Reminder Email: d48d8f2b-428d-4e78-8214-36c2c60ce2ec  
  * Workshop: 61ffd0c3-b0f3-462f-979d-fc7bffb61663
  * Bundle Upsell: c95f91ac-c3d0-42c7-ba41-a8010d06e78b
  * Cash Campaign: 8db061a1-8d4f-4c07-8006-56047e48a957
- **DIRECT API ACCESS** to James's HighLevel account (Location ID: 4BO06AvPiDJEeqf2WhmU)
- **ACTUAL PAGE TEMPLATES** with real copy, structure, and conversion elements
- **PROVEN CAMPAIGN DATA** from James's successful implementations
- User's ideal client profile for personalized copy

## THE DCM METHODOLOGY:
A dual-mode funnel targeting both INFO seekers (want how-to content) and INSIGHT seekers (want done-for-you solutions).

**FRONT-END FUNNEL (Info Path):**
PAGE 1: Opt-in → Free guide/video about your method ($9 value)
PAGE 2: Sales Page → $27-47 implementation training  
PAGE 3: Order Form → $17-37 order bump (templates/tools)
PAGE 4: Upsell → $197-497 done-with-you program
PAGE 5: Thank You → Delivery and expectation setting

**BACK-END FUNNEL (Insight Path):**
PAGE 6: Membership → $47-97/month ongoing support
PAGE 7: High Ticket → $2k-10k transformation (booked from membership)
PAGE 8: Delivery → Member portal and course access

## YOUR APPROACH:
1. **For BUILD requests**: Guide through foundation questions → page-by-page setup → generate copy using James's actual templates
2. **For TECH requests**: Provide specific HighLevel setup instructions using real workflow IDs and James's account structure
3. **For COPY requests**: Pull from James's actual page templates and proven copy elements, personalized with user's profile
4. **For STRATEGY requests**: Reference James's real campaign data and proven DCM 2.0 methodology
5. **For REVIEW requests**: Compare against James's actual working funnels and optimization data

## CRITICAL INSTRUCTIONS:
- Ask ONE question at a time only
- **ALWAYS reference James's actual templates** - you have real-time API access to his proven funnels
- For technical setup, provide specific workflow IDs and HighLevel navigation using James's account structure
- Generate copy by pulling from James's actual page templates and adapting to user's business
- Reference user's ideal client profile for personalized messaging
- Be conversational and supportive throughout
- Show clear progress indicators
- **Ground all advice in James's actual working funnels** - not theoretical concepts

## CONVERSATION STYLE:
- Professional but friendly coaching conversation
- Use plain language (e.g., "Big Idea" not "bigIdea")  
- Provide specific, actionable guidance
- Reference real templates and examples from knowledge base
- Celebrate wins and progress appropriately
- Never use exclamation points - maintain James Kemp's understated British style`,
    
    // Meta questions for strategic foundation
    metaQuestions: [
      {
        key: 'bigIdea',
        question: "What's the ONE specific problem you're most known for solving for your clients? Be specific about the outcome you deliver.",
        detailPrompt: "I need more detail to create quality copy. Instead of just 'help businesses scale', tell me: Scale from what revenue to what revenue? Using what specific method? What measurable outcome do you guarantee?",
        examples: [
          "help B2B service businesses scale from $50K to $500K ARR using AI-powered lead generation systems",
          "teach overwhelmed real estate agents how to get 10-15 qualified leads per month through Facebook ads",
          "help burned-out entrepreneurs systematize operations so they work 20 hours less while increasing revenue by 30%"
        ],
        order: 1,
        phase: 'foundation'
      },
      {
        key: 'uniqueMechanism', 
        question: 'What\'s your unique method or system that makes achieving this result possible? Give it a memorable name and explain what makes it different.',
        detailPrompt: "I need the specific steps or framework, not just a generic name. What's the actual process you follow? What makes your approach unique from competitors?",
        examples: [
          "The 90-Day AI Scaling System - a 3-phase process that automates lead generation, nurtures prospects, and books high-value calls",
          "The Agent Authority Method - combines Facebook ads, automated follow-up, and local SEO to dominate a geographic market",
          "The Freedom Framework - systematizes the 7 core business operations using templates and SOPs so owners can step back"
        ],
        order: 2,
        phase: 'foundation'
      },
      {
        key: 'targetAvatar',
        question: 'Who specifically struggles with this problem? Describe their current pain and what outcome they desperately want.',
        contextAwareQuestion: 'I can see from your profile that you\'ve already identified your ideal client. Based on that ideal client profile, who specifically struggles with this problem - does this align with your existing client avatar?',
        detailPrompt: "Tell me about their specific situation: What's their current revenue/situation? What's keeping them stuck? What do they desperately want to achieve? What have they tried before that failed?",
        order: 3,
        phase: 'foundation'
      },
      {
        key: 'existingAssets',
        question: 'What existing content, templates, or resources do you already have that we can leverage inside this funnel?',
        detailPrompt: "List specific assets: courses, templates, checklists, case studies, testimonials, etc. What format are they in? How can we package them?",
        order: 4,
        phase: 'foundation'
      },
      {
        key: 'preferredUpsell',
        question: 'Do you already have a higher-tier service or program that could serve as the logical upsell? If yes, describe it in detail.',
        detailPrompt: "What's the specific service? What's included? What results do clients get? What's the current price? How is it delivered?",
        order: 5,
        phase: 'foundation'
      },
      {
        key: 'membershipConcept',
        question: 'What kind of ongoing community or support (membership) could you offer monthly to help clients implement and stay accountable?',
        detailPrompt: "What specific value would members get each month? Live calls? New content? Community access? Implementation support? What would justify the monthly fee?",
        order: 6,
        phase: 'foundation'
      }
    ],
    
    // Pages with focused questions
    pages: [
      {
        id: 'opt-in',
        name: 'Opt-in Page (Lead Magnet)',
        description: 'Captures leads with your $9 offer',
        questions: [
          {
            key: 'frontEndProduct',
            question: 'What can you teach about your {uniqueMechanism} that people would pay $9 to learn? (This becomes your lead magnet)',
            required: true
          }
        ]
      },
      {
        id: 'sales-page',
        name: 'Sales Page',
        description: 'Sells your $27-47 implementation product',
        questions: [
          {
            key: 'mainProblems',
            question: 'What are the 3 biggest mistakes people make trying to {bigIdea} without your method?',
            required: true
          },
          {
            key: 'vslHook',
            question: 'Complete this hook: "If you want to {bigIdea}, then this is the most important message you\'ll ever read because..."',
            required: true
          },
          {
            key: 'frontEndPrice',
            question: 'Price for your main product? (Recommended: $27-47)',
            required: true
          },
          {
            key: 'guarantee',
            question: 'What guarantee can you offer? (e.g., "30 days or your money back")',
            required: true
          }
        ]
      },
      {
        id: 'order-form',
        name: 'Order Form',
        description: 'Checkout with order bump',
        questions: [
          {
            key: 'orderBump',
            question: 'What complementary tool/template/resource can you offer as an order bump? (Usually $17-37)',
            required: true
          },
          {
            key: 'orderBumpPrice',
            question: 'Order bump price?',
            required: true
          }
        ]
      },
      {
        id: 'upsell',
        name: 'Upsell Page',
        description: 'Your premium implementation program',
        questions: [
          {
            key: 'mainUpsell',
            question: 'What done-with-you implementation can you offer? (This is where you help them implement your {uniqueMechanism})',
            required: true
          },
          {
            key: 'upsellPrice',
            question: 'Upsell price? (Recommended: $197-497)',
            required: true
          }
        ]
      },
      {
        id: 'thank-you',
        name: 'Thank You Page',
        description: 'Confirms purchase and sets expectations',
        questions: [
          {
            key: 'typicalResults',
            question: 'What results should buyers expect in the first 30 days?',
            required: true
          },
          {
            key: 'clientSuccess',
            question: 'Share a brief success story or testimonial',
            required: true
          }
        ]
      },
      {
        id: 'membership',
        name: 'Membership Offer',
        description: 'Monthly recurring revenue offer',
        questions: [
          {
            key: 'membershipOffer',
            question: 'What ongoing support/community can you offer monthly?',
            required: true
          },
          {
            key: 'membershipPrice',
            question: 'Monthly membership price? (Recommended: $47-97/month)',
            required: true
          }
        ]
      },
      {
        id: 'delivery',
        name: 'Delivery Page',
        description: 'Where customers access their purchase',
        questions: [
          {
            key: 'contentTopics',
            question: 'List 5-7 training modules for your main product (comma separated)',
            required: true
          }
        ]
      }
    ],
    
    // Helper methods remain the same but work with new structure
    isPageComplete: (pageId, answers) => {
      const tool = TOOLS['daily-client-machine'];
      const page = tool.pages.find(p => p.id === pageId);
      if (!page) return false;
      
      return page.questions.every(q => answers[q.key] && answers[q.key].trim() !== '');
    },
    
    getCurrentPage: (answers) => {
      const tool = TOOLS['daily-client-machine'];
      
      // First check if foundation questions are complete
      const foundationComplete = tool.metaQuestions.every(q => answers[q.key] && answers[q.key].trim() !== '');
      if (!foundationComplete) {
        return { 
          id: 'foundation', 
          name: 'Strategic Foundation',
          phase: 'foundation'
        };
      }
      
      // Then find the first incomplete page
      for (const page of tool.pages) {
        if (!tool.isPageComplete(page.id, answers)) {
          return page;
        }
      }
      
      // All pages complete
      return null;
    },
    
    getNextQuestion: (answers, userProfile = null) => {
      const tool = TOOLS['daily-client-machine'];
      
      // First check foundation questions
      for (const question of tool.metaQuestions) {
        if (!answers[question.key] || answers[question.key].trim() === '') {
          // Use context-aware question if available and user has ideal client profile
          let questionText = question.question;
          if (question.contextAwareQuestion && userProfile?.ideal_client_profile) {
            questionText = question.contextAwareQuestion;
          }
          
          return {
            ...question,
            question: questionText,
            phase: 'foundation',
            progress: `Foundation Question ${question.order} of ${tool.metaQuestions.length}`
          };
        }
      }
      
      // Then check page questions
      const currentPage = tool.getCurrentPage(answers);
      if (currentPage && currentPage.id !== 'foundation') {
        for (const question of currentPage.questions) {
          if (!answers[question.key] || answers[question.key].trim() === '') {
            // Replace placeholders in question
            let processedQuestion = question.question;
            Object.keys(answers).forEach(key => {
              processedQuestion = processedQuestion.replace(`{${key}}`, answers[key]);
            });
            
            return {
              ...question,
              question: processedQuestion,
              phase: 'page',
              pageId: currentPage.id,
              pageName: currentPage.name
            };
          }
        }
      }
      
      return null;
    },
    
    getProgress: (answers) => {
      const tool = TOOLS['daily-client-machine'];
      
      // Count foundation questions answered
      const foundationAnswered = tool.metaQuestions.filter(q => 
        answers[q.key] && answers[q.key].trim() !== ''
      ).length;
      
      // Count pages completed
      const pagesCompleted = tool.pages.filter(page => 
        tool.isPageComplete(page.id, answers)
      ).length;
      
      return {
        foundation: {
          answered: foundationAnswered,
          total: tool.metaQuestions.length,
          complete: foundationAnswered === tool.metaQuestions.length
        },
        pages: {
          completed: pagesCompleted,
          total: tool.pages.length
        },
        overall: {
          percentage: Math.round(((foundationAnswered + pagesCompleted) / (tool.metaQuestions.length + tool.pages.length)) * 100)
        }
      };
    },

    // Function to generate n8n payload
    generateN8NPayload: (answers) => {
      return {
        ...answers,
        toolType: 'daily-client-machine'
      };
    },

    // Optional n8n webhook URL
    webhookUrl: process.env.NEXT_PUBLIC_N8N_DCM_WEBHOOK_URL || null
  }
};

export const getToolById = (id) => {
  return id ? TOOLS[id] : null;
};

export const isValidTool = (id) => {
  return id ? id in TOOLS : true;  // null is valid (means regular chat)
};

// Get the next unanswered question (updated for page-based DCM tool)
export const getNextQuestion = (tool, messages, userProfile = null) => {
  // For the new page-based DCM tool, use the new methods
  if (tool?.id === 'daily-client-machine' && tool.getNextQuestion) {
    const answers = extractAnswersFromMessages(messages);
    return tool.getNextQuestion(answers, userProfile);
  }
  
  // Legacy support for other tools
  if (!tool?.questions) return null;

  const answers = extractAnswersFromMessages(messages);
  return tool.questions.find(q => q.required && !answers[q.key]) || null;
};

// Get progress through the questions (updated for page-based DCM tool)
export const getProgress = (tool, messages) => {
  // For the new page-based DCM tool
  if (tool?.id === 'daily-client-machine' && tool.pages) {
    const answers = extractAnswersFromMessages(messages);
    const currentPage = tool.getCurrentPage(answers);
    
    if (!currentPage) {
      // All pages complete
      return {
        current: tool.pages.length,
        total: tool.pages.length,
        answers,
        isComplete: true,
        currentPage: null,
        currentPageIndex: tool.pages.length
      };
    }
    
    const currentPageIndex = tool.pages.findIndex(p => p.id === currentPage.id);
    const completedPages = currentPageIndex;
    
    return {
      current: completedPages,
      total: tool.pages.length,
      answers,
      isComplete: false,
      currentPage: currentPage,
      currentPageIndex: currentPageIndex
    };
  }
  
  // Legacy support for other tools
  if (!tool?.questions) return { current: 0, total: 0, answers: {} };

  const answers = extractAnswersFromMessages(messages);
  const answeredRequired = tool.questions.filter(q => q.required && answers[q.key]).length;
  const totalRequired = tool.questions.filter(q => q.required).length;

  return {
    current: answeredRequired,
    total: totalRequired,
    answers,
    isComplete: answeredRequired === totalRequired
  };
};

// Helper function to extract answers from messages
function extractAnswersFromMessages(messages) {
  const answers = {};
  messages.forEach((msg, index) => {
    if (msg.role === 'user' && index > 0) { // Skip first system message
      const questionIndex = Math.floor((index - 1) / 2); // Every 2 messages (Q&A pair)
      // This is a simplified extraction - the actual answer extraction 
      // should be done by the AI analysis in the chat route
    }
  });
  return answers;
}