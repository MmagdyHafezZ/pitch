import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { act } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/admin',
}))

jest.mock('@/lib/client', () => ({
  api: {
    admin: {
      users: {
        list: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    },
  },
}))

const { api } = jest.requireMock('@/lib/client')

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider>
      <Notifications />
      {children}
    </MantineProvider>
  )
}

const makeUser = (
  overrides: Partial<{
    id: string
    name: string
    email: string
    isActive: boolean
    createdAt: string
    updatedAt: string
  }> = {}
) => ({
  id: 'user-1',
  name: 'Alice Smith',
  email: 'alice@example.com',
  isActive: true,
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
  ...overrides,
})

describe('UsersManagement page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows skeletons while loading', () => {
    api.admin.users.list.mockReturnValue(new Promise(() => {}))

    const UsersPage = require('../../users/page').default

    act(() => {
      render(
        <Wrapper>
          <UsersPage />
        </Wrapper>
      )
    })

    const skeletons = document.querySelectorAll('[class*="Skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders user email in table after load', async () => {
    api.admin.users.list.mockResolvedValue([
      makeUser({ id: 'u1', name: 'Alice Smith', email: 'alice@example.com' }),
      makeUser({ id: 'u2', name: 'Bob Jones', email: 'bob@example.com' }),
    ])

    const UsersPage = require('../../users/page').default

    await act(async () => {
      render(
        <Wrapper>
          <UsersPage />
        </Wrapper>
      )
    })

    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument()
      expect(screen.getByText('bob@example.com')).toBeInTheDocument()
    })
  })

  it('search input filters users by name/email', async () => {
    api.admin.users.list.mockResolvedValue([
      makeUser({ id: 'u1', name: 'Alice Smith', email: 'alice@example.com' }),
      makeUser({ id: 'u2', name: 'Bob Jones', email: 'bob@example.com' }),
    ])

    const UsersPage = require('../../users/page').default

    await act(async () => {
      render(
        <Wrapper>
          <UsersPage />
        </Wrapper>
      )
    })

    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/search by name, email, or id/i)
    fireEvent.change(searchInput, { target: { value: 'alice' } })

    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument()
      expect(screen.queryByText('bob@example.com')).not.toBeInTheDocument()
    })
  })
})
