import { renderHook } from '@testing-library/react'
import { usePostHog } from '@/hooks/use-posthog'

const capture = jest.fn()
const identifyFn = jest.fn()

const mockPosthog = { capture, identify: identifyFn }

jest.mock('posthog-js/react', () => ({
  usePostHog: () => mockPosthog
}))

describe('usePostHog hook', () => {
  beforeEach(() => {
    capture.mockClear()
    identifyFn.mockClear()
  })

  it('exposes trackEvent and identify functions', () => {
    const { result } = renderHook(() => usePostHog())
    result.current.trackEvent('test', { a: 1 })
    expect(capture).toHaveBeenCalledWith('test', { a: 1 })
    result.current.identify('user1', { b: 2 })
    expect(identifyFn).toHaveBeenCalledWith('user1', { b: 2 })
  })
})

