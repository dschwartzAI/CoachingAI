const mockOpenAI = jest.fn(() => ({
  chat: { completions: { create: jest.fn() } },
  embeddings: { create: jest.fn() }
}))
jest.mock('openai', () => ({ OpenAI: mockOpenAI }))
jest.mock('@anthropic-ai/sdk', () => ({ __esModule: true, default: jest.fn() }))
jest.mock('next/server', () => ({ __esModule: true, NextResponse: { json: jest.fn() } }))
jest.mock('next/headers', () => ({ __esModule: true, cookies: jest.fn() }))
jest.mock('@supabase/ssr', () => ({ __esModule: true, createServerClient: jest.fn() }))

global.Response = class {}

let openaiInstance

const saveMemoryMock = jest.fn()
jest.mock('@/lib/utils/memory', () => ({
  saveMemory: (...args) => saveMemoryMock(...args)
}))

describe('classifyAndSaveMemory', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('saves memory when classification allows', async () => {
    const { classifyAndSaveMemory } = await import('@/app/api/chat/route')
    openaiInstance = mockOpenAI.mock.results[0].value
    openaiInstance.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ should_write_memory: true, memory_type: 'note' }) } }]
    })
    openaiInstance.embeddings.create.mockResolvedValue({ data: [{ embedding: [0.2] }] })
    await classifyAndSaveMemory('hello', 't1', 'u1')
    expect(openaiInstance.chat.completions.create).toHaveBeenCalledWith({
      model: 'gpt-4o',
      messages: expect.any(Array),
      temperature: 0,
      response_format: { type: 'json_object' }
    })
    expect(openaiInstance.embeddings.create).toHaveBeenCalledWith({ model: 'text-embedding-3-small', input: 'hello' })
    expect(saveMemoryMock).toHaveBeenCalledWith({
      user_id: 'u1',
      thread_id: 't1',
      content: 'hello',
      embedding: [0.2],
      memory_type: 'note'
    })
  })

  it('skips saving when classification disallows', async () => {
    const { classifyAndSaveMemory } = await import('@/app/api/chat/route')
    openaiInstance = mockOpenAI.mock.results[0].value
    openaiInstance.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ should_write_memory: false }) } }]
    })
    await classifyAndSaveMemory('hello', 't1', 'u1')
    expect(openaiInstance.embeddings.create).not.toHaveBeenCalled()
    expect(saveMemoryMock).not.toHaveBeenCalled()
  })
})
