import { getOrCreateContext, saveContext } from "./store";
import { parseUserResponse } from "./response-parser";
import { getNextQuestion } from "./question-flow";
import { generateResponse } from "./response-generator";

/**
 * Main function called by the API route.
 * @param {string} userInput - raw user message
 * @param {string} conversationId - UUID of thread/chat
 * @returns {object} payload with { message, currentQuestionKey, collectedAnswers, questionsAnswered, isComplete, chatId }
 */
export function handleWorkshopConversation(userInput, conversationId) {
  const context = getOrCreateContext(conversationId);

  // Keep history (only latest 20 to limit memory)
  context.conversationHistory.push(userInput);
  if (context.conversationHistory.length > 20) {
    context.conversationHistory.shift();
  }

  // Parse the response and update context
  const extracted = parseUserResponse(userInput, context);

  // Mark collected flags for extracted keys
  Object.keys(extracted).forEach((k) => {
    context.collected[k] = true;
  });

  // Decide next question
  const nextQuestion = getNextQuestion(context);

  let responseToUser = "";
  if (!nextQuestion) {
    // Build final plan summary (simplistic)
    responseToUser =
      "Fantastic! We've gathered everything needed for your workshop: " +
      `Participants will ${context.outcome}. Audience: ${context.audience.description}. ` +
      `We'll address ${context.audience.painPoints.join(" and ")}. I'll start generating a full workshop plan now!`;
  } else {
    // Generate acknowledgement + question
    responseToUser = generateResponse(context, nextQuestion);
    if (nextQuestion.key === "confirm") {
      responseToUser += nextQuestion.question;
    } else {
      // Avoid re-asking if partially answered
      responseToUser += nextQuestion.question;
    }
  }

  // Persist context
  saveContext(conversationId, context);

  // Build collectedAnswers summary for frontend (flatten simple keys)
  const collectedAnswers = {
    outcome: context.outcome,
    audienceDescription: context.audience.description,
    painPoints: context.audience.painPoints.join(", "),
    problem: context.problem
  };

  return {
    message: responseToUser,
    currentQuestionKey: nextQuestion ? nextQuestion.key : null,
    collectedAnswers,
    questionsAnswered: Object.values(context.collected).filter(Boolean).length,
    isComplete: !nextQuestion,
    chatId: conversationId
  };
} 