import { OpenAI } from 'openai';
import { hybridOfferQuestions } from './questions';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

export async function validateHybridOfferAnswer(questionKey, answer) {
  if (!answer || answer.trim().length < 3) {
    return { isValid: false, reason: 'The answer is too short to provide meaningful information.' };
  }
  if (questionKey === 'offerDescription' && answer.trim().length < 50 && answer.trim().split(' ').length <= 5) {
    return { isValid: true, reason: null, topic: 'service description' };
  }
  if (questionKey === 'clientResult') {
    const cleanedAnswer = answer.toLowerCase();
    const hasResultKeywords = /\b(made|increased|grew|saved|achieved|revenue|profit|sales|leads|reduction|extra|helped|generated|improved|boosted|doubled|tripled|gained|earned|won|success|result|outcome|impact|million|thousand|percent|%|dollars?|clients?|customers?)\b/.test(cleanedAnswer);
    const hasQuantifiableTerms = /[0-9$€£¥%]|(?:one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|million|billion|more|less|better|faster|higher|lower)/.test(cleanedAnswer);
    if ((hasResultKeywords || hasQuantifiableTerms) && answer.trim().split(' ').length >= 3) {
      return { isValid: true, reason: null, topic: 'client success story' };
    }
    if (answer.trim().length > 10 && /\b(client|customer|company|business|helped|worked)\b/.test(cleanedAnswer)) {
      return { isValid: true, reason: null, topic: 'client success story' };
    }
    if (answer.trim().split(' ').length >= 5) {
      return { isValid: true, reason: null, topic: 'client success story' };
    }
  }

  const validationCriteria = {
    offerDescription: 'Should describe a product or service. It can be a concise name (e.g., \"Web Design Service\") or a more detailed explanation. Must focus on WHAT is being offered, not pricing or audience.',
    targetAudience: "Should describe who the offering is for - demographics, professions, or characteristics. Must focus on WHO the clients are, not what they're charged or the problems they have.",
    painPoints: 'Should identify problems or challenges that the target audience experiences. Must focus on PROBLEMS clients face, not solutions or pricing.',
    solution: 'Should explain how the product/service addresses the pain points in a unique way. Must focus on HOW problems are solved, not pricing or audience.',
    pricing: 'Should provide information about pricing structure, tiers, or general price range. Must focus on COSTS or pricing models, not other aspects.',
    clientResult: 'Should describe any client success, outcome, or result. Can be very brief.'
  };

  const validationPrompt = [
    {
      role: 'system',
      content: `You are an assistant that validates answers for creating a hybrid offer.\nFor 'offerDescription', a concise service name (e.g., 'Career Coaching', 'Airbnb Revenue Management') IS a valid and sufficient answer.\nFor 'clientResult', be EXTREMELY LENIENT. ANY mention of helping a client, achieving a result, or positive outcome should be marked as valid.`
    },
    {
      role: 'user',
      content: `Question category: ${questionKey}\nValidation criteria: ${validationCriteria[questionKey]}\nUser's answer: "${answer}"\n\nReturn JSON in this format: { "isValid": boolean, "reason": "explanation if invalid", "topic": "what topic the answer actually addresses" }`
    }
  ];

  try {
    const validationCompletion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: validationPrompt,
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });
    const validationResult = JSON.parse(validationCompletion.choices[0].message.content);
    return validationResult;
  } catch (error) {
    return { isValid: true, reason: null };
  }
}
