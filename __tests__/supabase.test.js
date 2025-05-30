import { fetchThreads, getThreads, deleteThread } from '@/lib/utils/supabase'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'

jest.mock('@/lib/utils/supabase', () => {
  const actual = jest.requireActual('@/lib/utils/supabase')
  return { __esModule: true, ...actual }
})

import * as supabaseUtils from '@/lib/utils/supabase'
// Destructure the exports object so we can spy on real implementations
const { isProfileComplete, isUserProfileComplete, supabaseExports } = supabaseUtils

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
})

describe('supabase utils', () => {
  it('fetchThreads is an alias for getThreads', () => {
    expect(fetchThreads).toBe(getThreads)
  })

  it('deleteThread throws when id missing', async () => {
    await expect(deleteThread()).rejects.toThrow('Thread ID is required')
  })

  it('isProfileComplete detects missing fields', () => {
    const profile = { full_name: 'A', occupation: '', desired_mrr: '1', desired_hours: '2' }
    expect(isProfileComplete(profile)).toBe(false)
  })

  it('isProfileComplete detects full profile', () => {
    const profile = { full_name: 'A', occupation: 'Dev', desired_mrr: '1', desired_hours: '2' }
    expect(isProfileComplete(profile)).toBe(true)
  })

  it('isUserProfileComplete uses getUserProfile', async () => {
    jest.spyOn(supabaseExports, 'getUserProfile').mockResolvedValue({
      full_name: 'Test',
      occupation: 'Dev',
      desired_mrr: '1',
      desired_hours: '2'
    })
    await expect(isUserProfileComplete('user')).resolves.toBe(true)
    expect(supabaseExports.getUserProfile).toHaveBeenCalledWith('user')
  })
})
