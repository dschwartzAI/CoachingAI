import { render, fireEvent, screen } from '@testing-library/react'
import NotificationBell from '@/components/NotificationBell'

jest.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'test-user' } })
}))

describe('NotificationBell', () => {
  it('shows no notifications message when none are present', () => {
    render(<NotificationBell chats={[]} currentChat={null} setCurrentChat={jest.fn()} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText(/No notifications/i)).toBeInTheDocument()
  })
})
