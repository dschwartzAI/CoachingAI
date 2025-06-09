import { render, act } from '@testing-library/react'
import { PostHogProvider } from '@/components/PostHogProvider'

const capture = jest.fn()
const debug = jest.fn()

const mockPosthog = { capture, debug }
const init = jest.fn((_key, opts) => {
  if (opts.loaded) {
    opts.loaded(mockPosthog)
  }
})

jest.mock('posthog-js', () => ({ __esModule: true, default: { init } }))
jest.mock('posthog-js/react', () => ({
  PostHogProvider: ({ children }) => children,
  usePostHog: () => mockPosthog
}))

let path = '/chat/1'
let search = ''

jest.mock('next/navigation', () => ({
  usePathname: () => path,
  useSearchParams: () => ({ toString: () => search })
}))

describe('PostHogProvider pageview tracking', () => {
  beforeEach(() => {
    capture.mockClear()
    init.mockClear()
  })

  it('captures $pageview on route change', () => {
    const { rerender } = render(
      <PostHogProvider>
        <div>Hello</div>
      </PostHogProvider>
    )
    expect(capture).toHaveBeenCalled() // initial load
    const initialCalls = capture.mock.calls.length
    act(() => {
      path = '/chat/2'
      rerender(
        <PostHogProvider>
          <div>Hello</div>
        </PostHogProvider>
      )
    })
    expect(capture.mock.calls.length).toBeGreaterThan(initialCalls)
  })
})

