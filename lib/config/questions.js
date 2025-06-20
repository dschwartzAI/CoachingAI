export const hybridOfferQuestions = [
  {
    key: 'offerType',
    question: 'What type of offer are you creating? Choose from: Membership, Community, Consulting, Service, Product, Course, or Workshop. (You can also describe it in your own words)',
    description: 'Offer category (membership, coaching, service, etc.)',
    required: true,
    type: 'select',
    options: ['Membership', 'Community', 'Consulting', 'Service', 'Product', 'Course', 'Workshop']
  },
  {
    key: 'offerDescription',
    question: 'Tell me about your core product/service at a high level. (e.g., "90-day business transformation program" or "Done-for-you marketing service")',
    description: 'Core product or service',
    required: true
  },
  {
    key: 'targetAudience',
    question: 'Who\'s your target audience? Be specific about who they are and what they\'re looking for. (e.g., "Small business owners making $100K-500K who want to scale without burnout")',
    contextAwareQuestion: 'I see you have an ideal client profile saved in your profile. Does this offer target the same audience described in your profile? If yes, just type "same as my ideal client profile". If it\'s different, please describe the specific audience for this offer. (You can view your profile by clicking "Profile Settings" in the sidebar)',
    description: 'Target audience details',
    required: true
  },
  {
    key: 'painPoints',
    question: 'What are the main challenges or pain points your target audience is facing? (e.g., "Struggling with lead generation and working 60+ hour weeks")',
    description: 'Customer pain points',
    required: true
  },
  {
    key: 'promiseSolution',
    question: 'What specific transformation or outcome do you promise your clients? (e.g., "Double revenue in 90 days", "Get 50 qualified leads per month", "90 days of AI-planned content")',
    description: 'Promise and transformation outcome',
    required: true
  },
  {
    key: 'clientResult',
    question: 'Share a specific success story or result you\'ve achieved for a client. (e.g., "Helped Sarah increase revenue from $200K to $500K in 6 months")',
    description: 'Client success story',
    required: true
  },
  {
    key: 'uniqueMechanism',
    question: 'Do you have a name for your unique system or methodology? (e.g., "The 3K Code", "Daily Client Machine", "SCALE Framework"). If not, would you like us to create one for your offer document?',
    description: 'Name for unique system/methodology',
    required: true
  },
  {
    key: 'phases',
    question: 'What phases do your clients experience in their transformation journey with you? (e.g., "Discovery → Strategy → Implementation → Results" or "Struggling → Learning → Growing → Thriving")',
    description: 'Client transformation journey phases',
    required: true
  },
  {
    key: 'paymentTerms',
    question: 'What are your payment options? (e.g., "$5,000 one-time payment or $1,000/month for 6 months")',
    description: 'Payment options',
    required: true
  },
  {
    key: 'guaranteeScarcity',
    question: 'What guarantee are you offering and what creates urgency? (e.g., "100% money-back guarantee if no results in 90 days. Only 10 spots available this quarter.")',
    description: 'Guarantee and urgency elements',
    required: true
  }
];

export const workshopQuestions = [
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
