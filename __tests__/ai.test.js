import { getAIResponse } from '@/lib/utils/ai'

describe('getAIResponse', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
    delete process.env.NEXT_PUBLIC_USE_DIRECT_QUESTIONS
  })

  it('returns error for empty input', async () => {
    const result = await getAIResponse('', { messages: [] })
    expect(result).toEqual({ error: 'Cannot process empty input.' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns first tool question when direct mode enabled', async () => {
    process.env.NEXT_PUBLIC_USE_DIRECT_QUESTIONS = 'true'
    const result = await getAIResponse('', { tool_id: 'hybrid-offer', messages: [] })
    expect(result.content).toMatch(/Welcome!/)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('streams response for regular chat', async () => {
    const encoder = new TextEncoder()
    const chunks = [encoder.encode('Hello'), encoder.encode(' World')]
    let index = 0
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        getReader() {
          return {
            read() {
              if (index < chunks.length) {
                return Promise.resolve({ done: false, value: chunks[index++] })
              }
              return Promise.resolve({ done: true })
            }
          }
        }
      }
    })

    const result = await getAIResponse('Hi', { messages: [] })
    expect(global.fetch).toHaveBeenCalled()
    expect(result).toEqual({ content: 'Hello World', isStreamed: true })
  })
})
