import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
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

  it('shows empty state when no users', async () => {
    api.admin.users.list.mockResolvedValue([])

    const UsersPage = require('../../users/page').default

    await act(async () => {
      render(
        <Wrapper>
          <UsersPage />
        </Wrapper>
      )
    })

    await waitFor(() => {
      expect(screen.getByText('No users found.')).toBeInTheDocument()
    })
  })

  it('shows "No users match your search" when search has no results', async () => {
    api.admin.users.list.mockResolvedValue([
      makeUser({ id: 'u1', name: 'Alice Smith', email: 'alice@example.com' }),
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

    fireEvent.change(screen.getByPlaceholderText(/search by name, email, or id/i), {
      target: { value: 'nonexistent-xyz' },
    })

    await waitFor(() => {
      expect(screen.getByText('No users match your search.')).toBeInTheDocument()
    })
  })

  it('shows Active/Inactive status badges', async () => {
    api.admin.users.list.mockResolvedValue([
      makeUser({ id: 'u1', name: 'Active User', isActive: true }),
      makeUser({ id: 'u2', name: 'Inactive User', isActive: false }),
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
      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByText('Inactive')).toBeInTheDocument()
    })
  })

  it('opens edit modal when edit button is clicked', async () => {
    api.admin.users.list.mockResolvedValue([
      makeUser({ id: 'u1', name: 'Alice Smith', email: 'alice@example.com' }),
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

    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row')
    const editBtn = within(rows[1]).getByRole('button')
    await act(async () => {
      fireEvent.click(editBtn)
    })

    await waitFor(() => {
      expect(screen.getByText('Edit User')).toBeInTheDocument()
      expect(screen.getByLabelText('Name')).toHaveValue('Alice Smith')
    })
  })

  it('saves user changes via edit modal', async () => {
    api.admin.users.list.mockResolvedValue([
      makeUser({ id: 'u1', name: 'Alice Smith', email: 'alice@example.com' }),
    ])
    api.admin.users.update.mockResolvedValue({})

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

    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row')
    const editBtn = within(rows[1]).getByRole('button')
    await act(async () => {
      fireEvent.click(editBtn)
    })

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alice Johnson' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Update$/ }))
    })

    await waitFor(() => {
      expect(api.admin.users.update).toHaveBeenCalledWith('u1', {
        name: 'Alice Johnson',
        isActive: true,
      })
    })
  })

  it('shows total users count after load', async () => {
    api.admin.users.list.mockResolvedValue([
      makeUser({ id: 'u1', name: 'Alice' }),
      makeUser({ id: 'u2', name: 'Bob' }),
      makeUser({ id: 'u3', name: 'Charlie' }),
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
      expect(screen.getByText('3 total users')).toBeInTheDocument()
    })
  })

  it('email field is disabled in the edit modal', async () => {
    api.admin.users.list.mockResolvedValue([
      makeUser({ id: 'u1', name: 'Alice Smith', email: 'alice@example.com' }),
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

    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row')
    const editBtn = within(rows[1]).getByRole('button')
    await act(async () => {
      fireEvent.click(editBtn)
    })

    await waitFor(() => {
      expect(screen.getByLabelText('Email')).toBeDisabled()
    })
  })
})
