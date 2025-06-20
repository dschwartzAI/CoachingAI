# PostHog Content Tracking Setup

This feature enables anonymous analysis of user messages to improve AI responses and system prompts. It's designed to be privacy-conscious and configurable.

## Environment Variables

Add these to your `.env.local` file:

```bash
# PostHog Content Tracking (for improving AI responses)
# Set to 'true' to enable anonymous content analysis and topic tracking
NEXT_PUBLIC_POSTHOG_TRACK_CONTENT=true

# Set to 'true' to track sanitized message content (removes PII)
# Only enable if you need full content analysis for prompt optimization
NEXT_PUBLIC_POSTHOG_TRACK_FULL_CONTENT=false
```

## What Gets Tracked

### Basic Analytics (always tracked)
- Message sent events with length and metadata
- Tool usage patterns
- Chat creation and completion events

### Content Analysis (when `POSTHOG_TRACK_CONTENT=true`)
- **Business Topics**: Marketing, sales, operations, finance, strategy, product, coaching
- **Question Types**: Problems, goals, how-to, what-is, why, clarification requests
- **Business Stages**: Startup, growth, established, struggling
- **Sentiment**: Frustrated, excited, uncertain, confident
- **Key Phrases**: Most frequently mentioned terms (filtered for relevance)

### Tool-Specific Patterns
- **Hybrid Offer Creator**: Question progression, topic focus, completion patterns
- **Workshop Generator**: Content themes, user goals, success rates
- **Ideal Client Extractor**: Demographics focus, pain point identification
- **Daily Client Machine**: Funnel interests, business model patterns

### Privacy Protection
- **PII Removal**: Automatically removes emails, phone numbers, URLs, credit cards
- **Content Sanitization**: Truncates long messages, removes sensitive data
- **Anonymous Tracking**: No personal information stored
- **Opt-in Only**: Must be explicitly enabled via environment variables

## Events Tracked

### Message Analysis
```javascript
// Event: message_analyzed
{
  messageLength: 150,
  wordCount: 25,
  toolId: 'hybrid-offer',
  primaryTopic: 'marketing',
  primaryQuestionType: 'how',
  primaryBusinessStage: 'startup',
  primarySentiment: 'excited',
  topics: [
    { topic: 'marketing', confidence: 0.8, keywords: ['funnel', 'lead'] },
    { topic: 'sales', confidence: 0.6, keywords: ['conversion'] }
  ],
  keyPhrases: [
    { phrase: 'landing', frequency: 3 },
    { phrase: 'conversion', frequency: 2 }
  ]
}
```

### Tool-Specific Patterns
```javascript
// Event: hybrid_offer_pattern
{
  topics: ['marketing', 'sales'],
  questionType: 'goal',
  businessStage: 'growth',
  sentiment: 'confident',
  questionIndex: 3,
  chatId: 'chat-uuid'
}
```

### Tool Progress Tracking
```javascript
// Event: tool_progress
{
  toolId: 'workshop-generator',
  stage: 'initiated',
  timestamp: 1640995200000
}

// Event: tool_completion
{
  toolId: 'hybrid-offer',
  success: true,
  questionsAnswered: 8,
  completionTime: 300000, // 5 minutes
  chatId: 'chat-uuid'
}
```

## Use Cases for Data

### Prompt Optimization
- Identify topics where users struggle most
- Find question types that need better responses
- Discover common pain points not addressed

### Tool Improvement
- Track where users drop off in tool flows
- Identify confusing questions or steps
- Measure tool effectiveness and completion rates

### Content Strategy
- Understand what business challenges are most common
- Find gaps in coaching content
- Identify successful conversation patterns

### User Experience
- Detect frustration patterns
- Identify successful user journeys
- Optimize tool ordering and suggestions

## PostHog Dashboard Setup

### Recommended Insights

1. **Topic Trends**
   - Event: `message_analyzed`
   - Group by: `primaryTopic`
   - Chart: Trend over time

2. **Tool Completion Rates**
   - Event: `tool_completion`
   - Filter: `success = true`
   - Group by: `toolId`

3. **User Sentiment Analysis**
   - Event: `message_analyzed`
   - Group by: `primarySentiment`
   - Chart: Pie chart

4. **Question Type Distribution**
   - Event: `message_analyzed`
   - Group by: `primaryQuestionType`
   - Chart: Bar chart

5. **Business Stage Analysis**
   - Event: `message_analyzed`
   - Group by: `primaryBusinessStage`
   - Chart: Trend over time

### Funnel Analysis
Create funnels to track:
- Tool initiation → First question → Completion
- Topic identification → Solution delivery → Satisfaction
- Problem statement → Goal clarification → Action plan

## Privacy Compliance

### GDPR Compliance
- Content tracking is opt-in via environment variables
- No personal data is stored
- Users can request data deletion through PostHog
- Clear documentation of what data is collected

### Data Retention
- Set appropriate retention periods in PostHog settings
- Consider shorter retention for content analysis data
- Regular review of tracked data categories

### User Transparency
Consider adding a privacy notice mentioning:
- Anonymous usage analytics for service improvement
- No personal information stored
- Ability to opt out upon request

## Implementation Notes

### Performance
- Content analysis runs client-side
- Minimal impact on chat response times
- Graceful degradation if PostHog is unavailable

### Error Handling
- Failed tracking doesn't affect chat functionality
- Errors logged to console for debugging
- Automatic retry for critical events

### Testing
- Test with `POSTHOG_TRACK_CONTENT=false` to disable
- Verify PII removal in sanitization function
- Check PostHog events in browser developer tools

## Monitoring

### Key Metrics to Watch
- Event delivery success rate
- Content analysis accuracy
- Performance impact on chat response times
- User satisfaction correlation with tracked patterns

### Alerts to Set Up
- Sudden drop in event tracking
- High error rates in content analysis
- Unusual patterns in user sentiment
- Tool completion rate changes 