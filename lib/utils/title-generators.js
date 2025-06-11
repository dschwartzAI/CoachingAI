export const generateToolSpecificTitle = async (toolType, context) => {
  const prompts = {
    'workshop': `Generate a title for a workshop about: ${context.topic}`,
    'hybrid-offer': `Generate a title for a hybrid offer creation session about: ${context.offerType}`,
    'jamesbot': 'Generate a title based on the coaching conversation topic'
  };
  const systemPrompt = prompts[toolType] || prompts.jamesbot;
  // Call OpenAI API with specific prompt
  // ... implementation
}; 