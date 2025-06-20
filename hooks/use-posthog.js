"use client"

import { usePostHog as usePostHogReact } from 'posthog-js/react'
import { analyzeMessage, sanitizeForTracking } from '@/lib/utils/content-analysis'

export function usePostHog() {
  const posthog = usePostHogReact()

  const track = (event, properties = {}) => {
    if (posthog) {
      posthog.capture(event, properties)
    }
  }

  const identify = (userId, properties = {}) => {
    if (posthog) {
      posthog.identify(userId, properties)
    }
  }

  const reset = () => {
    if (posthog) {
      posthog.reset()
    }
  }

  const setPersonProperties = (properties) => {
    if (posthog) {
      posthog.setPersonProperties(properties)
    }
  }

  const alias = (alias) => {
    if (posthog) {
      posthog.alias(alias)
    }
  }

  // Content tracking methods
  const trackMessageContent = (message, context = {}) => {
    // Check if content tracking is enabled
    const contentTrackingEnabled = process.env.NEXT_PUBLIC_POSTHOG_TRACK_CONTENT === 'true'
    
    if (!posthog || !contentTrackingEnabled) {
      return
    }

    try {
      // Analyze message content
      const analysis = analyzeMessage(message, context.toolId, context)
      
      // Track comprehensive message analysis
      posthog.capture('message_analyzed', {
        // Basic metrics
        messageLength: analysis.messageLength,
        wordCount: analysis.wordCount,
        toolId: analysis.toolId,
        
        // Content classifications
        primaryTopic: analysis.primaryTopic,
        primaryQuestionType: analysis.primaryQuestionType,
        primaryBusinessStage: analysis.primaryBusinessStage,
        primarySentiment: analysis.primarySentiment,
        
        // Detailed analysis (top 3 of each)
        topics: analysis.topics.slice(0, 3),
        questionTypes: analysis.questionTypes.slice(0, 3),
        businessStages: analysis.businessStages.slice(0, 3),
        sentiments: analysis.sentiments.slice(0, 3),
        keyPhrases: analysis.keyPhrases.slice(0, 5),
        
        // Context
        ...context
      })

      // Track sanitized content if full content tracking is enabled
      const fullContentEnabled = process.env.NEXT_PUBLIC_POSTHOG_TRACK_FULL_CONTENT === 'true'
      if (fullContentEnabled) {
        const sanitizedContent = sanitizeForTracking(message)
        posthog.capture('message_content', {
          content: sanitizedContent,
          toolId: context.toolId,
          messageLength: message.length,
          ...context
        })
      }

      // Track specific patterns for different tools
      if (context.toolId) {
        trackToolSpecificPatterns(analysis, context)
      }

    } catch (error) {
      console.warn('[PostHog] Error tracking message content:', error)
    }
  }

  const trackToolSpecificPatterns = (analysis, context) => {
    if (!posthog) return

    const { toolId } = context

    // Track tool-specific usage patterns
    switch (toolId) {
      case 'hybrid-offer':
        posthog.capture('hybrid_offer_pattern', {
          topics: analysis.topics.map(t => t.topic),
          questionType: analysis.primaryQuestionType,
          businessStage: analysis.primaryBusinessStage,
          sentiment: analysis.primarySentiment,
          questionIndex: context.questionsAnswered || 0,
          ...context
        })
        break

      case 'workshop-generator':
        posthog.capture('workshop_pattern', {
          topics: analysis.topics.map(t => t.topic),
          questionType: analysis.primaryQuestionType,
          businessStage: analysis.primaryBusinessStage,
          sentiment: analysis.primarySentiment,
          ...context
        })
        break

      case 'ideal-client-extractor':
        posthog.capture('ideal_client_pattern', {
          topics: analysis.topics.map(t => t.topic),
          questionType: analysis.primaryQuestionType,
          businessStage: analysis.primaryBusinessStage,
          sentiment: analysis.primarySentiment,
          ...context
        })
        break

      case 'daily-client-machine':
        posthog.capture('dcm_pattern', {
          topics: analysis.topics.map(t => t.topic),
          questionType: analysis.primaryQuestionType,
          businessStage: analysis.primaryBusinessStage,
          sentiment: analysis.primarySentiment,
          ...context
        })
        break

      default:
        // General chat pattern
        posthog.capture('general_chat_pattern', {
          topics: analysis.topics.map(t => t.topic),
          questionType: analysis.primaryQuestionType,
          businessStage: analysis.primaryBusinessStage,
          sentiment: analysis.primarySentiment,
          ...context
        })
    }
  }

  const trackToolProgress = (toolId, stage, metadata = {}) => {
    if (!posthog) return

    posthog.capture('tool_progress', {
      toolId,
      stage,
      timestamp: Date.now(),
      ...metadata
    })
  }

  const trackToolCompletion = (toolId, success, metadata = {}) => {
    if (!posthog) return

    posthog.capture('tool_completion', {
      toolId,
      success,
      completionTime: metadata.completionTime,
      questionsAnswered: metadata.questionsAnswered,
      dropOffPoint: metadata.dropOffPoint,
      ...metadata
    })
  }

  const trackUserStruggles = (issue, context = {}) => {
    if (!posthog) return

    posthog.capture('user_struggle', {
      issue,
      toolId: context.toolId,
      stage: context.stage,
      timestamp: Date.now(),
      ...context
    })
  }

  const trackTopicInterest = (topics, context = {}) => {
    if (!posthog || !Array.isArray(topics)) return

    topics.forEach(topic => {
      posthog.capture('topic_interest', {
        topic: topic.topic,
        confidence: topic.confidence,
        keywords: topic.keywords,
        toolId: context.toolId,
        ...context
      })
    })
  }

  return {
    track,
    identify,
    reset,
    setPersonProperties,
    alias,
    posthog,
    // New content tracking methods
    trackMessageContent,
    trackToolProgress,
    trackToolCompletion,
    trackUserStruggles,
    trackTopicInterest
  }
} 