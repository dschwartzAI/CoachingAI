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
    description: 'Determine your ideal client profile through expert copywriting analysis',
    initiatesConversation: true, // Tool starts the conversation
    model: 'claude-opus', // Use Claude Opus for this tool
    systemMessage: `You are a copywriting expert conducting an in-depth interview. 

Your job is to dig DEEP through probing questions to uncover rich insights about my customers that I haven't even thought of yet.

CRITICAL INSTRUCTIONS:
- You MUST ask at least 15-20 probing questions before creating any psychographic brief
- NEVER summarize or create a brief until you've gathered comprehensive information
- Ask ONE question at a time - keep it focused
- When I answer, ask 2-3 follow-up questions to go deeper
- Challenge my assumptions and dig for emotional drivers
- Keep responses BRIEF with good spacing for readability
- Provide 2-3 short examples to spark ideas

INTERVIEW FLOW:
1. Start with demographics/firmographics
2. Dig into their current situation and daily frustrations
3. Explore emotional pain points and what keeps them up at night
4. Uncover their dreams, aspirations, and definition of success
5. Investigate their buying process and decision criteria
6. Understand their objections and fears
7. Discover their language, phrases, and how they describe their problems

Only after thorough investigation, create a detailed psychographic brief using H2, bold, bullets, and tables.

Remember: Your goal is to uncover insights I don't even know about my customers yet. Be relentless in your curiosity.

Common considerations/things you'll want to analyze to help create the best psychographic possible:
[1. Product/Service Details: I'll aim to gain a comprehensive understanding of your product or service. This includes its features, benefits, unique selling points, and how it solves specific problems or addresses customer needs. I'll ask questions to uncover the intricate details that can help me highlight the value proposition effectively.

2. Target Audience: Understanding your target audience is crucial for creating copy that speaks directly to them. I'll inquire about the demographics, psychographics, pain points, desires, and buying behaviors of your ideal customers. This information will help me tailor the messaging and language to resonate with their specific needs and preferences.

3. Competitive Landscape: Positioning your product or service in the market is essential. I'll seek to understand your competitors, their offerings, and how your product or service differentiates itself. This will allow me to craft copy that highlights your unique advantages and sets you apart from the competition.

4. Brand Voice and Messaging: Every brand has a distinct personality and tone that should be reflected in its messaging. I'll aim to understand your brand's voice, values, and the emotional connections you want to establish with your audience. This will guide the language, style, and overall messaging approach.

5. Marketing Goals and Objectives: Understanding your specific marketing goals and objectives will help me craft copy that aligns with your desired outcomes. Whether it's increasing brand awareness, driving sales, or nurturing customer relationships, I'll tailor the copy to support your overall marketing strategy.

6. Customer Testimonials and Success Stories: Real-life examples and testimonials from satisfied customers can be powerful in convincing prospects. I'll inquire about customer success stories, case studies, or testimonials that can be incorporated into the copy to build trust and credibility.

7. Existing Marketing Materials: If you have any existing marketing materials, such as brochures, website copy, social media posts, or advertising campaigns, it would be beneficial for me to review them. This will give me insights into your current messaging, tone, and approach, allowing me to maintain consistency or identify areas for improvement.

8. Market Research and Analytics: Any market research, customer surveys, or analytics data you can provide would be invaluable. These insights can help me understand customer behavior, preferences, and pain points more deeply, as well as identify trends or opportunities in the market.

9. Product Demonstrations or Samples: If possible, arranging for a product demonstration or providing me with samples would be incredibly helpful. Experiencing your product or service firsthand will allow me to better appreciate its features, functionality, and unique selling points, enabling me to communicate them more effectively in the copy.

10. Customer Interviews or Feedback: Direct feedback from existing customers can provide invaluable insights. If you have the opportunity to connect me with a few satisfied customers, I can gather their perspectives, understand their motivations for choosing your product or service, and capture their experiences in their own words, which can be powerful in the copy.

11. Visual Assets: High-quality visuals, such as product images, lifestyle shots, or graphics, can greatly enhance the impact of the copy. If you have access to these assets, providing them would allow me to integrate them seamlessly with the written content for a more engaging and persuasive experience.

12. Sales Team Insights: If you have a sales team that interacts directly with customers, gathering their insights and perspectives would be valuable. They often have a deep understanding of customer objections, frequently asked questions, and the language that resonates best with prospects.]`,
    initialMessage: null, // Will be dynamically generated based on profile context
    // No predefined questions since this is a dynamic interview process
    questions: [],
    // Function to check if complete (for this tool, completion is subjective)
    isComplete: () => false, // Always allow continuation
    // No n8n integration for this tool
    generateN8NPayload: null,
    webhookUrl: null
  },
  'daily-client-machine': {
    id: 'daily-client-machine',
    name: 'Daily Client Machine Builder',
    description: 'Build your complete DCM funnel with expert copywriting for all 8 pages',
    initiatesConversation: true,
    model: 'gpt-4o', // Use GPT-4o for superior copywriting at lower cost
    systemMessage: `You are a DCM funnel copywriter. Help users build their Daily Client Machine - a dual-path funnel system that generates both clients AND customers daily.

DCM FRAMEWORK:
- INSIGHT PATH: Free content → Big Idea Video → Case Study → High-ticket offer  
- INFO PATH: Paid ads → Low-ticket product ($9) → Order bump ($29) → Upsell ($99) → Membership

CRITICAL RULES:
- Be 80% more concise than normal
- Ask ONE specific question at a time
- Use their profile info to avoid redundant questions
- Focus on ACTIONABLE specifics, not vague concepts
- Generate copy for 8 HighLevel pages when complete

The DCM works because it creates a sustainable system where low-ticket customers fund your marketing to attract high-ticket clients. Focus on practical, implementable elements.`,
    questions: [
      // Section 1: Core Concept & Audience
      {
        key: 'bigIdea',
        question: "What specific problem do you solve that people will pay $9 to learn about? (e.g., 'Get 5 qualified leads per week without paid ads' or 'Close 3 new clients monthly using LinkedIn')",
        hint: "Think: What immediate, specific outcome can you teach in a template/mini-course?",
        required: true
      },
      {
        key: 'bigIdeaDescription',
        question: "What's your unique method/system name for solving this? (e.g., 'The LinkedIn Authority Method' or 'The 5-Touch Follow-Up System')",
        hint: "Give it a memorable name that positions you as the expert",
        required: true
      },
      {
        key: 'targetAudience',
        question: "Who's your ideal client? Be specific (e.g., 'B2B consultants making $5-15k/month')",
        hint: "Include income level and business stage",
        required: true
      },
      
      // Section 2: Problems & Solutions
      {
        key: 'mainProblems',
        question: "What are the top 3 problems your target audience faces that your {bigIdea} solves?",
        hint: "Think both surface problems (not enough leads) and deeper issues (feast or famine cycles)",
        required: true
      },
      {
        key: 'currentSolutions',
        question: "What solutions have they already tried that didn't work? Why did those fail?",
        hint: "This helps position your approach as the better alternative",
        required: true
      },
      {
        key: 'uniqueAdvantage',
        question: "What's the #1 advantage of your approach compared to these other solutions?",
        hint: "Example: 'Works without paid ads' or 'Gets results in 30 days vs 6 months'",
        required: true
      },
      
      // Section 3: Product Stack
      {
        key: 'frontEndProduct',
        question: "What's your $9-29 front-end product?",
        hint: "Templates, mini-course, or workshop that shows your method",
        required: true
      },
      {
        key: 'frontEndPrice',
        question: "What price point for your front-end product? (Recommended: $9, $17, or $27)",
        hint: "Lower prices ($9-17) get more volume, higher ($27) better for warm audiences",
        required: true
      },
      {
        key: 'orderBump',
        question: "What's your order bump offer? This should complement your front-end product at $27-47.",
        hint: "Example: If selling templates, bump could be 'Done-for-you email sequences' or 'Video training on implementation'",
        required: true
      },
      {
        key: 'orderBumpPrice',
        question: "Price for your order bump?",
        hint: "Typically $27-47, should be an easy yes",
        required: true
      },
      {
        key: 'mainUpsell',
        question: "What's your main upsell bundle ($97-297)? This should be a comprehensive package that accelerates results.",
        hint: "Bundle multiple trainings, templates, or include group coaching access",
        required: true
      },
      {
        key: 'upsellPrice',
        question: "Price for your main upsell?",
        hint: "$97-197 for cold traffic, up to $297 for warm",
        required: true
      },
      {
        key: 'membershipOffer',
        question: "Describe your membership/community offer. What ongoing support and value do members receive?",
        hint: "Include: community access, monthly trainings, Q&A calls, resource library, etc.",
        required: true
      },
      {
        key: 'membershipPrice',
        question: "What's your membership pricing? (Monthly or weekly)",
        hint: "Example: '$97/month' or '$50/week'. Consider offering a trial like '$9 for 9 days'",
        required: true
      },
      
      // Section 4: Results & Proof
      {
        key: 'clientSuccess',
        question: "Share your best client success story. Be specific with numbers and timeframes.",
        hint: "Example: 'Sarah went from 2 clients/month to 10 clients/month in 90 days using my system'",
        required: true
      },
      {
        key: 'typicalResults',
        question: "What results can someone typically expect in their first 30-90 days using your {bigIdea}?",
        hint: "Be realistic but compelling - what's achievable with consistent implementation?",
        required: true
      },
      {
        key: 'guarantee',
        question: "What guarantee will you offer? (This reduces risk and increases conversions)",
        hint: "Examples: '30-day money back', 'Double your leads in 90 days or free coaching', 'Get your first client in 30 days'",
        required: true
      },
      
      // Section 5: Content & Messaging
      {
        key: 'contentTopics',
        question: "What are 3-5 content topics you regularly create content about? (These pre-sell your DCM)",
        hint: "Should relate to your big idea, problems you solve, or success stories",
        required: true
      },
      {
        key: 'vslHook',
        question: "For your Big Idea Video (VSL), what's the main hook that will grab attention in the first 10 seconds?",
        hint: "Example: 'How I went from 2 clients to 47 clients in 6 months without running a single ad'",
        required: true
      }
    ],
    // Function to check if all required questions are answered
    isComplete: (answers) => {
      return TOOLS['daily-client-machine'].questions
        .filter(q => q.required)
        .every(q => answers[q.key]);
    },
    // Function to generate n8n payload (optional)
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

// Get the next unanswered question
export const getNextQuestion = (tool, messages) => {
  if (!tool?.questions) return null;

  // Extract answers from messages
  const answers = {};
  messages.forEach((msg, index) => {
    if (msg.role === 'user' && index > 0) { // Skip first system message
      const questionIndex = Math.floor((index - 1) / 2); // Every 2 messages (Q&A pair)
      const question = tool.questions[questionIndex];
      if (question) {
        answers[question.key] = msg.content;
      }
    }
  });

  // Find first unanswered required question
  return tool.questions.find(q => q.required && !answers[q.key]) || null;
};

// Get progress through the questions
export const getProgress = (tool, messages) => {
  if (!tool?.questions) return { current: 0, total: 0, answers: {} };

  const answers = {};
  messages.forEach((msg, index) => {
    if (msg.role === 'user' && index > 0) {
      const questionIndex = Math.floor((index - 1) / 2);
      const question = tool.questions[questionIndex];
      if (question) {
        answers[question.key] = msg.content;
      }
    }
  });

  const answeredRequired = tool.questions.filter(q => q.required && answers[q.key]).length;
  const totalRequired = tool.questions.filter(q => q.required).length;

  return {
    current: answeredRequired,
    total: totalRequired,
    answers,
    isComplete: answeredRequired === totalRequired
  };
};