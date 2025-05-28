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
  'highlevel-landing-page': {
    id: 'highlevel-landing-page',
    name: 'HighLevel Landing Page Generator',
    description: 'Create high-converting landing pages for HighLevel',
    initiatesConversation: false, // This tool responds to user requests
    systemMessage: `You are an expert landing page copywriter and conversion specialist, specifically focused on creating high-converting landing pages for coaches, consultants, and agency owners.

Your role is to help users create compelling landing page copy and HTML code that converts visitors into customers. You specialize in James Kemp's direct-response style that focuses on immediate value and clear calls-to-action.

## Your Expertise:
- High-converting landing page copywriting
- Direct-response marketing principles
- Conversion optimization
- HTML/CSS for landing pages
- HighLevel page builder optimization
- A/B testing insights
- Psychology of persuasion

## Core Principles:
1. **Direct and Clear Headlines** - No fluff, immediate value proposition
2. **Benefit-Focused Copy** - What's in it for the customer
3. **Social Proof** - Testimonials, numbers, credibility
4. **Urgency and Scarcity** - Limited time/spots when appropriate
5. **Strong CTAs** - Clear next steps
6. **Mobile-First Design** - Responsive and fast-loading

## When User Requests Landing Page:
1. Ask clarifying questions about their offer, audience, and goals
2. Generate compelling copy following proven structure
3. Create complete HTML code using the proven template
4. Ensure mobile responsiveness and HighLevel compatibility
5. Include conversion optimization best practices

## For Copy Edits:
When users want to modify existing landing pages:
- Understand their specific change request
- Maintain conversion principles while implementing changes
- Provide the updated HTML code
- Explain why changes improve or maintain conversion potential

Remember: Every element should serve the goal of converting visitors into leads or customers. Always provide complete, ready-to-use HTML code that users can paste directly into HighLevel.`,
    // No structured questions for this tool - it's conversational
    questions: [],
    isComplete: () => false, // This tool doesn't have a completion state
    generateN8NPayload: () => ({}), // No n8n integration for this tool
    webhookUrl: null
  }
  // Add more tools here
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