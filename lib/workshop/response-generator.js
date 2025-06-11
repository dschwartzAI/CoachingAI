// Generates a conversational acknowledgement + transition to next question
export function generateResponse(context, nextQuestion) {
  const acknowledgments = [
    "I love that",
    "That's excellent",
    "Perfect",
    "Great insight",
    "That makes total sense",
    "I can see how that would be challenging"
  ];

  const transitions = [
    "Building on that",
    "Speaking of which",
    "That brings us to",
    "Now that I understand that",
    "Given what you've shared"
  ];

  let response = "";

  // Acknowledge last user message
  if (context.conversationHistory.length > 0) {
    response += `${acknowledgments[Math.floor(Math.random() * acknowledgments.length)]}! `;

    // Reference latest pain point if exists
    if (context.audience.painPoints.length > 0) {
      const latestPain = context.audience.painPoints[context.audience.painPoints.length - 1];
      response += `${latestPain} is definitely a common challenge. `;
    }
  }

  // Add transition phrase
  response += `${transitions[Math.floor(Math.random() * transitions.length)]}, `;

  // If confirm type question, response will be appended later by caller.
  return response;
} 