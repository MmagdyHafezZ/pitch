import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
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
})
