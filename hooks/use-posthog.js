"use client"

import { usePostHog as usePostHogReact } from 'posthog-js/react'

export function usePostHog() {
  const posthog = usePostHogReact()

  const trackEvent = (event, properties = {}) => {
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

  return {
    trackEvent,
    track: trackEvent,
    identify,
    reset,
    setPersonProperties,
    alias,
    posthog
  }
} 