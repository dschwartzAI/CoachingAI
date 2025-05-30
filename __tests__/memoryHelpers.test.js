import { saveMemory, searchMemories } from '@/lib/utils/supabase'

jest.mock('@supabase/ssr', () => ({
  createBrowserClient: jest.fn()
}))

jest.mock('uuid', () => ({ v4: jest.fn(() => 'uuid-123') }))

const fromMock = jest.fn()
const insertMock = jest.fn(() => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'uuid-123' }, error: null }) }) }))
const rpcMock = jest.fn(() => Promise.resolve({ data: [{ id: 'm1' }], error: null }))

beforeEach(() => {
  require('@supabase/ssr').createBrowserClient.mockReturnValue({
    from: jest.fn(() => ({ insert: insertMock })),
    rpc: rpcMock
  })
})

describe('memory helpers', () => {
  it('saveMemory inserts into user_memories', async () => {
    await saveMemory({ userId: 'u1', threadId: 't1', content: 'text', type: 'general', embedding: [1] })
    expect(insertMock).toHaveBeenCalledWith({
      id: 'uuid-123',
      user_id: 'u1',
      thread_id: 't1',
      content: 'text',
      type: 'general',
      embedding: [1]
    })
  })

  it('searchMemories calls match_user_memories RPC', async () => {
    await searchMemories('u1', [0, 1], 3)
    expect(rpcMock).toHaveBeenCalledWith('match_user_memories', {
      query_embedding: [0, 1],
      match_count: 3,
      user_id: 'u1'
    })
  })
})
