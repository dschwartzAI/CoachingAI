export const TOOLS = {
  'hybrid-offer': {
    id: 'hybrid-offer',
    name: 'Hybrid Offer Creator',
    description: 'Create personalized hybrid offers',
    initiatesConversation: true, // Tool starts the conversation
    systemMessage: `You are a specialized assistant for creating hybrid coaching offers. Your role is to help coaches create compelling hybrid offers that combine both online and in-person elements.

Guide the user through the following aspects:
1. High-level offer description
2. Target audience identification
3. Pain points analysis
4. Unique solution approach
5. Pricing structure
6. Client results and success stories

For each response:
- Be encouraging and professional
- Ask follow-up questions when needed
- Provide specific suggestions based on the information shared
- Help refine and improve the offer elements
- Keep the conversation focused on creating an effective hybrid offer`,
    questions: [
      { 
        key: 'offerDescription',
        question: "Welcome! I'm excited to help you craft a fantastic hybrid offer. Could you tell me a bit about your core offering, whether it's a product or a service?",
        hint: "Example: A 12-week program combining weekly online group coaching with monthly in-person workshops",
        required: true
      },
      {
        key: 'targetAudience',
        question: "Great! Now, who is your ideal client for this offer? Be as specific as possible.",
        hint: "Consider demographics, psychographics, and their current situation",
        required: true
      },
      {
        key: 'painPoints',
        question: "What are the main challenges or pain points your ideal clients are facing?",
        hint: "Think about both surface-level problems and deeper underlying issues",
        required: true
      },
      {
        key: 'solution',
        question: "How does your hybrid approach uniquely solve these problems?",
        hint: "Focus on the benefits of combining online and in-person elements",
        required: true
      },
      {
        key: 'pricing',
        question: "What's your pricing structure for this offer?",
        hint: "Consider one-time payments, payment plans, and any bonuses or guarantees",
        required: true
      },
      {
        key: 'clientResults',
        question: "What's a specific, real-world result you've helped a client achieve? Share a concrete example.",
        hint: "Example: 'Helped a client double their monthly leads from 50 to 100 in 3 months.' Be specific!",
        required: true
      }
    ],
    // Function to check if all required questions are answered
    isComplete: (answers) => {
      return TOOLS['hybrid-offer'].questions
        .filter(q => q.required)
        .every(q => answers[q.key]);
    },
    // Function to generate n8n payload
    generateN8NPayload: (answers) => {
      return {
        offerDescription: answers.offerDescription,
        targetAudience: answers.targetAudience,
        painPoints: answers.painPoints,
        solution: answers.solution,
        pricing: answers.pricing,
        clientResults: answers.clientResults
      };
    },
    // n8n webhook URL
    webhookUrl: process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL
  },
  'workshop-generator': {
    id: 'workshop-generator',
    name: 'Workshop Generator',
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
- Keep the conversation focused on creating an effective workshop and landing page`,
    questions: [
      { 
        key: 'participantOutcomes',
        question: "Welcome! I'm excited to help you create a compelling workshop. Let's start with the most important part - what specific outcomes or goals will participants achieve by the end of your workshop?",
        hint: "Example: 'Participants will learn how to create a 90-day business plan and leave with a completed action plan for their first month'",
        required: true
      },
      {
        key: 'targetAudience',
        question: "Perfect! Now, who is your ideal workshop participant? Please describe their demographics, current situation, and main pain points.",
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
    description: 'Deep-dive interview to create detailed psychographic briefs of your ideal customers',
    model: 'claude-opus-4', // Use Claude Opus 4 (newest model) for this tool
    systemMessage: `You are a copywriting expert. 

Your job is to interview me and ask me as many probing questions as possible to better understand my customers and audience.

If I don't give you enough context, ask follow up questions to get further clarity before proceeding to the next question. From there, create a psychographic brief in an organized manner I can reference when doing my copywriting.

Use H2, bold, bullet points, paragraph, and table markdown to make the brief easy to read and understand.

Reply to this message with your first question.

Common considerations/things you'll want to analyze to help create the best psychographic possible:
[1. Product/Service Details: I'll aim to gain a comprehensive understanding of your product or service. This includes its features, benefits, unique selling points, and how it solves specific problems or addresses customer needs. I'll ask questions to uncover the intricate details that can help me highlight the value proposition effectively.

2. Target Audience: Understanding your target audience is crucial for creating copy that speaks directly to them. I'll inquire about the demographics, psychographics, pain points, desires, and buying behaviors of your ideal customers. This information will help me tailor the messaging and language to resonate with their specific needs and preferences.

3. Competitive Landscape: Positioning your product or service in the market is essential. I'll seek to understand your competitors, their offerings, and how your product or service differentiates itself. This will allow me to craft copy that highlights your unique advantages and sets you apart from the competition.

4. Brand Voice and Messaging: Every brand has a distinct personality and tone that should be reflected in its messaging. I'll aim to understand your brand's voice, values, and the emotional connections you want to establish with your audience. This will guide the language, style, and overall messaging approach.

5. Marketing Goals and Objectives: Understanding your specific marketing goals and objectives will help me craft copy that aligns with your desired outcomes. Whether it's increasing brand awareness, driving sales, or nurturing customer relationships, I'll tailor the copy to support your overall marketing strategy.

6. Customer Testimonials and Success Stories: Real-life examples and testimonials from satisfied customers can be powerful in convincing prospects. I'll inquire about customer success stories, case studies, or testimonials that can be incorporated into the copy to build trust and credibility.

7. Existing Marketing Materials: If you have existing marketing materials, I'll want to understand what has worked well and what hasn't. This will help me identify successful messaging elements and avoid repeating ineffective approaches.

8. Budget and Timeline: Understanding your budget and timeline constraints will help me provide realistic recommendations and prioritize the most impactful copy elements within your parameters.

9. Distribution Channels: Knowing where and how your copy will be used (website, social media, email campaigns, print materials, etc.) will influence the tone, length, and format of the messaging.

10. Conversion Goals: Understanding what specific actions you want your audience to take (purchase, sign up, download, contact, etc.) will help me craft compelling calls-to-action and structure the copy to guide readers toward those desired outcomes.

11. Emotional Triggers: Identifying the key emotions that motivate your target audience (fear, desire, urgency, trust, etc.) will help me incorporate persuasive elements that resonate on a deeper psychological level.

12. Objections and Concerns: Understanding common objections or hesitations your prospects might have will allow me to address these concerns proactively in the copy, removing barriers to conversion.]`,
    initialMessage: "I'm here to help you create a detailed psychographic brief of your ideal customers through an in-depth interview process. I'll ask you probing questions to uncover the psychology, motivations, and characteristics of your target audience.\n\nLet's start with this: **What product or service are you selling, and who do you believe is your ideal customer?**",
    // No predefined questions since this is a dynamic interview process
    questions: [],
    // Function to check if complete (for this tool, completion is subjective)
    isComplete: () => false, // Always allow continuation
    // No n8n integration for this tool
    generateN8NPayload: null,
    // Generation settings for Anthropic
    temperature: 0.3, // deterministic, analytical output
    maxTokens: 8000,  // allow very long briefs (Claude Sonnet has higher limits)
    // No external webhook
    webhookUrl: null
  },
  'daily-client-machine': {
    name: 'Daily Client Machine',
    description: 'Build your DCM 2.0 funnel step-by-step. Get immediate results as we create each page together.',
    icon: 'BrainCog',
    systemMessage: `You are the Daily Client Machine specialist helping users build their DCM 2.0 funnel strategically.

IMPORTANT: This is a STRATEGIC approach - we first establish the big idea and funnel architecture, then build each page with immediate copy generation.

## THE DCM 2.0 FRAMEWORK:
The Daily Client Machine creates TWO paths:
1. INFO Path: Low-ticket customers ($9-$47) who want information
2. INSIGHT Path: High-ticket clients ($2k-$10k) who want transformation

## PHASE 1: STRATEGIC FOUNDATION (Meta Questions)
Ask these ONE AT A TIME to establish the funnel architecture:
1. bigIdea: "What's the ONE specific problem you solve?" (e.g., "get 5 clients in 30 days", "lose 20 lbs without gym")
2. uniqueMechanism: "What's your unique method that makes this possible?" (e.g., "The 5-Minute Client System", "The Couch Potato Protocol")
3. targetAvatar: "Who specifically needs this?" (Focus on pain point + desired outcome)
4. funnelArchitecture: Show them their complete DCM structure based on their answers

## PHASE 2: PAGE-BY-PAGE BUILD
After foundation is set, build pages incrementally:

**PAGE 1: OPT-IN PAGE (Lead Magnet)**
Required: frontEndProduct (their $9 lead magnet idea)
Generate: Complete opt-in page copy

**PAGE 2: SALES PAGE** 
Required: mainProblems, vslHook, frontEndPrice, guarantee
Generate: Full sales page copy

**PAGE 3: ORDER FORM**
Required: orderBump, orderBumpPrice
Generate: Order form with bump copy

**PAGE 4: UPSELL**
Required: mainUpsell, upsellPrice
Generate: Complete upsell page

**PAGE 5: THANK YOU**
Required: typicalResults, clientSuccess
Generate: Thank you page with next steps

**PAGE 6: MEMBERSHIP**
Required: membershipOffer, membershipPrice
Generate: Recurring offer page

**PAGE 7: DELIVERY**
Required: contentTopics
Generate: Member area outline

**PAGE 8: COMPLETE EXPORT**
Generate: Full funnel document with implementation guide

## CRITICAL INSTRUCTIONS:
- Ask ONE question at a time only
- Be conversational and natural - don't use code-like formatting (e.g., don't write "bigIdea:" in responses)
- Never start with inappropriate enthusiasm on initial messages
- After the 3 foundation questions, show them their complete funnel architecture
- Explain each component of the DCM before asking for details
- Use examples from their industry when possible
- Generate copy immediately when each page's questions are complete
- Always show progress naturally (e.g., "Question 2 of 3" not "Foundation Question 2 of 3")

## RESPONSE FORMAT:
- Keep responses concise but valuable
- Write naturally as if having a conversation
- Include examples relevant to their business
- Show clear next steps after each answer
- Celebrate progress appropriately (not on first message)

## CONVERSATION STYLE:
- For initial message: Start with context about building their Daily Client Machine
- Be professional but friendly
- Don't format questions like code variables
- Ask questions as you would in a natural coaching conversation
- Use "Big Idea" not "bigIdea" when talking to users`,
    
    // Meta questions for strategic foundation
    metaQuestions: [
      {
        key: 'bigIdea',
        question: "What's the ONE specific problem you're most known for solving for your clients?",
        order: 1,
        phase: 'foundation'
      },
      {
        key: 'uniqueMechanism', 
        question: 'What\'s your unique method or system that makes achieving this result possible? (Give it a memorable name)',
        order: 2,
        phase: 'foundation'
      },
      {
        key: 'targetAvatar',
        question: 'Who specifically struggles with this problem? Describe their current pain and what outcome they desperately want.',
        order: 3,
        phase: 'foundation'
      },
      {
        key: 'existingAssets',
        question: 'What existing content, templates, or resources do you already have that we can leverage inside this funnel?',
        order: 4,
        phase: 'foundation'
      },
      {
        key: 'preferredUpsell',
        question: 'Do you already have a higher-tier service or program that could serve as the logical upsell? If yes, briefly describe it.',
        order: 5,
        phase: 'foundation'
      },
      {
        key: 'membershipConcept',
        question: 'What kind of ongoing community or support (membership) could you offer monthly to help clients implement and stay accountable?',
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
    
    getNextQuestion: (answers) => {
      const tool = TOOLS['daily-client-machine'];
      
      // First check foundation questions
      for (const question of tool.metaQuestions) {
        if (!answers[question.key] || answers[question.key].trim() === '') {
          return {
            ...question,
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
export const getNextQuestion = (tool, messages) => {
  // For the new page-based DCM tool, use the new methods
  if (tool?.id === 'daily-client-machine' && tool.getNextQuestion) {
    const answers = extractAnswersFromMessages(messages);
    return tool.getNextQuestion(answers);
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