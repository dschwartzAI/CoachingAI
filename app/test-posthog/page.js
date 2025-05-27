"use client"

import { usePostHog } from '@/hooks/use-posthog'
import { useState } from 'react'

export default function TestPostHogPage() {
  const { track } = usePostHog()
  const [eventCount, setEventCount] = useState(0)

  const sendTestEvent = () => {
    const newCount = eventCount + 1
    setEventCount(newCount)
    
    track('test_button_clicked', {
      click_count: newCount,
      page: 'test-posthog',
      timestamp: new Date().toISOString()
    })
    
    console.log('PostHog event sent:', 'test_button_clicked', { click_count: newCount })
  }

  const sendCustomEvent = () => {
    track('custom_event_test', {
      event_type: 'manual_test',
      user_action: 'clicked_custom_button',
      page: 'test-posthog'
    })
    
    console.log('PostHog custom event sent')
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          PostHog Test Page
        </h1>
        
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            Click the buttons below to send test events to PostHog
          </div>
          
          <button
            onClick={sendTestEvent}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
          >
            Send Test Event (Count: {eventCount})
          </button>
          
          <button
            onClick={sendCustomEvent}
            className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors"
          >
            Send Custom Event
          </button>
          
          <div className="text-xs text-gray-500 mt-4">
            Check your browser console for event confirmations and PostHog dashboard for event tracking.
          </div>
        </div>
      </div>
    </div>
  )
} 