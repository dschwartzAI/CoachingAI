export const createWorkshopContext = () => ({
  // Core workshop details
  title: null,
  outcome: null,
  problem: null,

  // Audience information
  audience: {
    description: null,
    demographics: {
      age: null,
      professions: [],
      businessType: null
    },
    painPoints: [],
    challenges: []
  },

  // Track what has been collected so we don't re-ask
  collected: {
    outcome: false,
    audienceDescription: false,
    demographics: false,
    painPoints: false,
    problem: false
  },

  // Conversation history for richer context / references
  conversationHistory: []
}); 