import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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
      teams: {
        list: jest.fn(),
        getMembers: jest.fn(),
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

const makeTeam = (
  overrides: Partial<{
    id: string
    name: string
    slug: string
    isActive: boolean
    billingEmail: string | null
    createdAt: string
    updatedAt: string
    memberships: any[]
  }> = {}
) => ({
  id: 'team-1',
  name: 'Acme Corp',
  slug: 'acme-corp',
  isActive: true,
  billingEmail: null,
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
  memberships: [],
  ...overrides,
})

describe('TeamsManagement page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    api.admin.teams.getMembers.mockResolvedValue([])
  })

  it('shows skeletons while loading', () => {
    api.admin.teams.list.mockReturnValue(new Promise(() => {}))

    const TeamsPage = require('../../teams/page').default

    act(() => {
      render(
        <Wrapper>
          <TeamsPage />
        </Wrapper>
      )
    })

    const skeletons = document.querySelectorAll('[class*="Skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders team name after load', async () => {
    api.admin.teams.list.mockResolvedValue([
      makeTeam({ id: 't1', name: 'Acme Corp', slug: 'acme-corp' }),
      makeTeam({ id: 't2', name: 'Beta Ltd', slug: 'beta-ltd' }),
    ])

    const TeamsPage = require('../../teams/page').default

    await act(async () => {
      render(
        <Wrapper>
          <TeamsPage />
        </Wrapper>
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument()
      expect(screen.getByText('Beta Ltd')).toBeInTheDocument()
    })
  })

  it('shows empty state when no teams', async () => {
    api.admin.teams.list.mockResolvedValue([])

    const TeamsPage = require('../../teams/page').default

    await act(async () => {
      render(
        <Wrapper>
          <TeamsPage />
        </Wrapper>
      )
    })

    await waitFor(() => {
      expect(screen.getByText('No teams found.')).toBeInTheDocument()
    })
  })

  it('search input filters teams by name', async () => {
    api.admin.teams.list.mockResolvedValue([
      makeTeam({ id: 't1', name: 'Acme Corp', slug: 'acme-corp' }),
      makeTeam({ id: 't2', name: 'Beta Ltd', slug: 'beta-ltd' }),
    ])

    const TeamsPage = require('../../teams/page').default

    await act(async () => {
      render(
        <Wrapper>
          <TeamsPage />
        </Wrapper>
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText(/search by name, slug, or id/i), {
      target: { value: 'acme' },
    })

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument()
      expect(screen.queryByText('Beta Ltd')).not.toBeInTheDocument()
    })
  })

  it('shows "No teams match your search" when search has no results', async () => {
    api.admin.teams.list.mockResolvedValue([
      makeTeam({ id: 't1', name: 'Acme Corp', slug: 'acme-corp' }),
    ])

    const TeamsPage = require('../../teams/page').default

    await act(async () => {
      render(
        <Wrapper>
          <TeamsPage />
        </Wrapper>
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText(/search by name, slug, or id/i), {
      target: { value: 'nonexistent' },
    })

    await waitFor(() => {
      expect(screen.getByText('No teams match your search.')).toBeInTheDocument()
    })
  })

  it('opens team drawer when clicking a team row', async () => {
    api.admin.teams.list.mockResolvedValue([
      makeTeam({
        id: 't1',
        name: 'Acme Corp',
        slug: 'acme-corp',
        billingEmail: 'billing@acme.com',
      }),
    ])
    api.admin.teams.getMembers.mockResolvedValue([
      {
        userId: 'u1',
        role: 'OWNER',
        isActive: true,
        user: { id: 'u1', name: 'Alice', email: 'alice@acme.com' },
      },
    ])

    const TeamsPage = require('../../teams/page').default

    await act(async () => {
      render(
        <Wrapper>
          <TeamsPage />
        </Wrapper>
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Acme Corp'))
    })

    await waitFor(() => {
      expect(screen.getByLabelText('Team Name')).toHaveValue('Acme Corp')
    })
    expect(screen.getByText('Overview')).toBeInTheDocument()
  })

  it('saves team changes in drawer', async () => {
    api.admin.teams.list.mockResolvedValue([
      makeTeam({ id: 't1', name: 'Acme Corp', slug: 'acme-corp' }),
    ])
    api.admin.teams.update.mockResolvedValue({})

    const TeamsPage = require('../../teams/page').default

    await act(async () => {
      render(
        <Wrapper>
          <TeamsPage />
        </Wrapper>
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Acme Corp'))
    })

    await waitFor(() => {
      expect(screen.getByLabelText('Team Name')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Team Name'), { target: { value: 'New Name' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    })

    await waitFor(() => {
      expect(api.admin.teams.update).toHaveBeenCalledWith('t1', {
        name: 'New Name',
        isActive: true,
      })
    })
  })

  it('shows Active/Inactive badges for teams', async () => {
    api.admin.teams.list.mockResolvedValue([
      makeTeam({ id: 't1', name: 'Active Team', isActive: true }),
      makeTeam({ id: 't2', name: 'Inactive Team', isActive: false }),
    ])

    const TeamsPage = require('../../teams/page').default

    await act(async () => {
      render(
        <Wrapper>
          <TeamsPage />
        </Wrapper>
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByText('Inactive')).toBeInTheDocument()
    })
  })

  it('shows total teams count after load', async () => {
    api.admin.teams.list.mockResolvedValue([
      makeTeam({ id: 't1', name: 'Team A' }),
      makeTeam({ id: 't2', name: 'Team B' }),
    ])

    const TeamsPage = require('../../teams/page').default

    await act(async () => {
      render(
        <Wrapper>
          <TeamsPage />
        </Wrapper>
      )
    })

    await waitFor(() => {
      expect(screen.getByText('2 total teams')).toBeInTheDocument()
    })
  })
})
