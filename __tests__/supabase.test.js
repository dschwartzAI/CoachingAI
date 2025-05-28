import { fetchThreads, getThreads, deleteThread } from '@/lib/utils/supabase'

describe('supabase utils', () => {
  it('fetchThreads is an alias for getThreads', () => {
    expect(fetchThreads).toBe(getThreads)
  })

  it('deleteThread throws when id missing', async () => {
    await expect(deleteThread()).rejects.toThrow('Thread ID is required')
  })
})
