/**
 * Content Analysis Utilities for PostHog Tracking
 * Helps understand user behavior and improve AI responses
 */

// Business topics classification
const BUSINESS_TOPICS = {
  marketing: ['marketing', 'advertising', 'promotion', 'brand', 'social media', 'content', 'seo', 'email', 'funnel', 'lead', 'conversion'],
  sales: ['sales', 'selling', 'prospect', 'client', 'customer', 'revenue', 'pricing', 'deal', 'close', 'pipeline'],
  operations: ['operations', 'process', 'workflow', 'automation', 'efficiency', 'team', 'hiring', 'management', 'productivity'],
  finance: ['money', 'revenue', 'profit', 'budget', 'cost', 'expense', 'pricing', 'mrr', 'arr', 'cash flow', 'investment'],
  strategy: ['strategy', 'planning', 'growth', 'scale', 'expansion', 'vision', 'goal', 'objective', 'roadmap', 'pivot'],
  product: ['product', 'service', 'feature', 'development', 'launch', 'mvp', 'feedback', 'iteration', 'improvement'],
  coaching: ['coaching', 'client', 'session', 'program', 'course', 'training', 'mentoring', 'consulting', 'expertise']
};

// Question types
const QUESTION_PATTERNS = {
  problem: ['problem', 'issue', 'challenge', 'struggle', 'difficulty', 'stuck', 'help', 'trouble', 'wrong'],
  goal: ['want to', 'need to', 'goal', 'achieve', 'reach', 'target', 'aim', 'objective', 'plan to'],
  how: ['how do', 'how can', 'how to', 'what is the best way', 'what should', 'steps to'],
  what: ['what is', 'what are', 'what does', 'what would', 'what should'],
  why: ['why is', 'why do', 'why should', 'why does', 'reason'],
  clarification: ['can you explain', 'what do you mean', 'clarify', 'elaborate', 'more details', 'expand on']
};

// Business stage indicators
const BUSINESS_STAGES = {
  startup: ['startup', 'just started', 'new business', 'launching', 'beginning', 'first', 'starting out'],
  growth: ['growing', 'scaling', 'expanding', 'more clients', 'increase', 'growth', 'bigger'],
  established: ['established', 'been doing this', 'years of', 'experienced', 'mature business', 'stable'],
  struggling: ['struggling', 'difficult', 'hard time', 'not working', 'failing', 'problems', 'challenges']
};

// Sentiment indicators
const SENTIMENT_INDICATORS = {
  frustrated: ['frustrated', 'annoying', 'difficult', 'hard', 'impossible', 'stuck', 'confused', 'overwhelmed'],
  excited: ['excited', 'great', 'amazing', 'love', 'fantastic', 'awesome', 'perfect', 'excellent'],
  uncertain: ['not sure', 'maybe', 'think', 'possibly', 'uncertain', 'confused', 'unclear', 'doubt'],
  confident: ['confident', 'sure', 'certain', 'know', 'definitely', 'absolutely', 'clear', 'positive']
};

/**
 * Classify the main business topics mentioned in a message
 */
export function classifyBusinessTopics(message) {
  const lowerMessage = message.toLowerCase();
  const topics = [];
  
  for (const [topic, keywords] of Object.entries(BUSINESS_TOPICS)) {
    const matches = keywords.filter(keyword => lowerMessage.includes(keyword));
    if (matches.length > 0) {
      topics.push({
        topic,
        confidence: matches.length / keywords.length,
        keywords: matches
      });
    }
  }
  
  return topics.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Identify the type of question being asked
 */
export function identifyQuestionType(message) {
  const lowerMessage = message.toLowerCase();
  const types = [];
  
  for (const [type, patterns] of Object.entries(QUESTION_PATTERNS)) {
    const matches = patterns.filter(pattern => lowerMessage.includes(pattern));
    if (matches.length > 0) {
      types.push({
        type,
        confidence: matches.length / patterns.length,
        patterns: matches
      });
    }
  }
  
  return types.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Detect business stage from message content
 */
export function detectBusinessStage(message) {
  const lowerMessage = message.toLowerCase();
  const stages = [];
  
  for (const [stage, indicators] of Object.entries(BUSINESS_STAGES)) {
    const matches = indicators.filter(indicator => lowerMessage.includes(indicator));
    if (matches.length > 0) {
      stages.push({
        stage,
        confidence: matches.length / indicators.length,
        indicators: matches
      });
    }
  }
  
  return stages.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Analyze sentiment from message content
 */
export function analyzeSentiment(message) {
  const lowerMessage = message.toLowerCase();
  const sentiments = [];
  
  for (const [sentiment, indicators] of Object.entries(SENTIMENT_INDICATORS)) {
    const matches = indicators.filter(indicator => lowerMessage.includes(indicator));
    if (matches.length > 0) {
      sentiments.push({
        sentiment,
        confidence: matches.length / indicators.length,
        indicators: matches
      });
    }
  }
  
  return sentiments.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Extract key phrases from message (useful for understanding common themes)
 */
export function extractKeyPhrases(message, minLength = 3) {
  // Simple key phrase extraction - remove common words and get meaningful phrases
  const commonWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'can', 'i', 'you', 'he', 'she', 'it',
    'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their'
  ]);
  
  const words = message.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= minLength && !commonWords.has(word));
  
  // Count word frequency
  const wordCount = {};
  words.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });
  
  // Return top phrases by frequency
  return Object.entries(wordCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([word, count]) => ({ phrase: word, frequency: count }));
}

/**
 * Comprehensive message analysis for PostHog tracking
 */
export function analyzeMessage(message, toolId = null, context = {}) {
  const analysis = {
    messageLength: message.length,
    wordCount: message.split(/\s+/).length,
    toolId,
    context,
    topics: classifyBusinessTopics(message),
    questionTypes: identifyQuestionType(message),
    businessStages: detectBusinessStage(message),
    sentiments: analyzeSentiment(message),
    keyPhrases: extractKeyPhrases(message)
  };
  
  // Add primary classifications (highest confidence)
  analysis.primaryTopic = analysis.topics[0]?.topic || 'general';
  analysis.primaryQuestionType = analysis.questionTypes[0]?.type || 'statement';
  analysis.primaryBusinessStage = analysis.businessStages[0]?.stage || 'unknown';
  analysis.primarySentiment = analysis.sentiments[0]?.sentiment || 'neutral';
  
  return analysis;
}

/**
 * Sanitize message content for privacy (remove potential PII)
 */
export function sanitizeForTracking(message, maxLength = 500) {
  // Remove potential email addresses, phone numbers, and URLs
  let sanitized = message
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
    .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]')
    .replace(/https?:\/\/[^\s]+/g, '[URL]')
    .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[CARD]');
  
  // Truncate if too long
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '...';
  }
  
  return sanitized;
} 