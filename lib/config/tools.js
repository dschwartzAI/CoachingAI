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
        question: "What results can clients expect? Share any success stories or typical outcomes.",
        hint: "Include both tangible and intangible results",
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