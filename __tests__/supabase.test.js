jest.mock('@/lib/utils/supabase', () => {
  const actual = jest.requireActual('@/lib/utils/supabase')
  return { __esModule: true, ...actual, getUserProfile: jest.fn() }
})

const supabase = require('@/lib/utils/supabase')

const {
  fetchThreads,
  getThreads,
  deleteThread,
  isProfileComplete,
  isUserProfileComplete,
  getUserProfile,
} = supabase

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

  it.skip('isUserProfileComplete uses getUserProfile', async () => {
    jest.spyOn(supabase, 'getUserProfile').mockResolvedValue({
      full_name: 'A',
      occupation: 'Dev',
      desired_mrr: '1',
      desired_hours: '2',
    })
    await expect(isUserProfileComplete('user')).resolves.toBe(true)
    expect(supabase.getUserProfile).toHaveBeenCalledWith('user')
  })
})
