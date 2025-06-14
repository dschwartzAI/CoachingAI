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

7. Existing Marketing Materials: If you have any existing marketing materials, such as brochures, website copy, social media posts, or advertising campaigns, it would be beneficial for me to review them. This will give me insights into your current messaging, tone, and approach, allowing me to maintain consistency or identify areas for improvement.

8. Market Research and Analytics: Any market research, customer surveys, or analytics data you can provide would be invaluable. These insights can help me understand customer behavior, preferences, and pain points more deeply, as well as identify trends or opportunities in the market.

9. Product Demonstrations or Samples: If possible, arranging for a product demonstration or providing me with samples would be incredibly helpful. Experiencing your product or service firsthand will allow me to better appreciate its features, functionality, and unique selling points, enabling me to communicate them more effectively in the copy.

10. Customer Interviews or Feedback: Direct feedback from existing customers can provide invaluable insights. If you have the opportunity to connect me with a few satisfied customers, I can gather their perspectives, understand their motivations for choosing your product or service, and capture their experiences in their own words, which can be powerful in the copy.

11. Visual Assets: High-quality visuals, such as product images, lifestyle shots, or graphics, can greatly enhance the impact of the copy. If you have access to these assets, providing them would allow me to integrate them seamlessly with the written content for a more engaging and persuasive experience.

12. Sales Team Insights: If you have a sales team that interacts directly with customers, gathering their insights and perspectives would be valuable. They often have a deep understanding of customer objections, frequently asked questions, and the language that resonates best with prospects.]`,
    initialMessage: "Welcome! I'm excited to help you create a comprehensive ideal client profile that will supercharge your copywriting efforts.\n\nLet's start with the foundation - **what product or service are you offering?** Please describe what you're selling, including any key features or benefits that make it special.\n\nDon't worry about being perfect - we'll dive deeper as we go!",
    // No predefined questions since this is a dynamic interview process
    questions: [],
    // Function to check if complete (for this tool, completion is subjective)
    isComplete: () => false, // Always allow continuation
    // No n8n integration for this tool
    generateN8NPayload: null,
    webhookUrl: null
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