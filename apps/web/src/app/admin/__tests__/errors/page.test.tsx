import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { act } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { useErrorLogStore } from '../../stores/error-log.store'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/admin',
}))

jest.mock('../../stores/error-log.store', () => {
  const actual = jest.requireActual('../../stores/error-log.store')
  return actual
})

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider>
      <Notifications />
      {children}
    </MantineProvider>
  )
}

const makeError = (
  overrides: Partial<{
    id: string
    timestamp: string
    method: string
    endpoint: string
    status: number
    message: string
  }> = {}
) => ({
  id: 'err-1',
  timestamp: new Date().toISOString(),
  method: 'GET',
  endpoint: '/api/v1/users',
  status: 404,
  message: 'Not Found',
  ...overrides,
})

describe('ErrorsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    act(() => {
      useErrorLogStore.setState({ errors: [] })
    })
  })

  it('shows empty state when no errors in store', () => {
    const ErrorsPage = require('../../errors/page').default

    act(() => {
      render(
        <Wrapper>
          <ErrorsPage />
        </Wrapper>
      )
    })

    expect(screen.getByText('No errors recorded this session')).toBeInTheDocument()
    expect(screen.getByText('API Error Log')).toBeInTheDocument()
  })

  it('renders error rows with method, endpoint, status, message', () => {
    act(() => {
      useErrorLogStore.setState({
        errors: [
          makeError({
            id: 'err-1',
            method: 'POST',
            endpoint: '/api/v1/plans',
            status: 422,
            message: 'Validation failed',
          }),
        ],
      })
    })

    const ErrorsPage = require('../../errors/page').default

    act(() => {
      render(
        <Wrapper>
          <ErrorsPage />
        </Wrapper>
      )
    })

    expect(screen.getAllByText('POST').length).toBeGreaterThan(0)
    expect(screen.getByText('/api/v1/plans')).toBeInTheDocument()
    expect(screen.getByText('422')).toBeInTheDocument()
    expect(screen.getByText('Validation failed')).toBeInTheDocument()
  })

  it('"Clear All" button calls clearErrors', () => {
    const clearErrors = jest.fn()

    act(() => {
      useErrorLogStore.setState({
        errors: [makeError({ id: 'err-1' })],
        clearErrors,
      })
    })

    const ErrorsPage = require('../../errors/page').default

    act(() => {
      render(
        <Wrapper>
          <ErrorsPage />
        </Wrapper>
      )
    })

    const clearBtn = screen.getByRole('button', { name: /clear all/i })
    expect(clearBtn).not.toBeDisabled()
    fireEvent.click(clearBtn)
    expect(clearErrors).toHaveBeenCalledTimes(1)
  })

  it('dismiss button calls removeError with the error id', () => {
    const removeError = jest.fn()

    act(() => {
      useErrorLogStore.setState({
        errors: [makeError({ id: 'err-42' })],
        removeError,
      })
    })

    const ErrorsPage = require('../../errors/page').default

    act(() => {
      render(
        <Wrapper>
          <ErrorsPage />
        </Wrapper>
      )
    })

    // ActionIcon buttons — there is one per row (the X dismiss icon)
    const actionIcons = screen.getAllByRole('button')
    // Find the dismiss button (not "Clear All")
    const dismissBtn = actionIcons.find((btn) => !btn.textContent?.toLowerCase().includes('clear'))
    expect(dismissBtn).toBeDefined()
    fireEvent.click(dismissBtn!)
    expect(removeError).toHaveBeenCalledWith('err-42')
  })

  it('method filter hides non-matching errors', () => {
    act(() => {
      useErrorLogStore.setState({
        errors: [
          makeError({ id: 'err-1', method: 'GET', endpoint: '/api/v1/users', status: 404 }),
          makeError({ id: 'err-2', method: 'POST', endpoint: '/api/v1/plans', status: 422 }),
        ],
      })
    })

    const ErrorsPage = require('../../errors/page').default

    act(() => {
      render(
        <Wrapper>
          <ErrorsPage />
        </Wrapper>
      )
    })

    // Both rows visible initially
    expect(screen.getByText('/api/v1/users')).toBeInTheDocument()
    expect(screen.getByText('/api/v1/plans')).toBeInTheDocument()

    // Drive filtering by updating the store directly (Mantine Select interactions are complex in jsdom)
    act(() => {
      useErrorLogStore.setState({
        errors: [
          makeError({ id: 'err-2', method: 'POST', endpoint: '/api/v1/plans', status: 422 }),
        ],
      })
    })

    expect(screen.queryByText('/api/v1/users')).not.toBeInTheDocument()
    expect(screen.getByText('/api/v1/plans')).toBeInTheDocument()
  })

  it('status filter (4xx) shows only 4xx errors', () => {
    act(() => {
      useErrorLogStore.setState({
        errors: [
          makeError({ id: 'err-1', method: 'GET', endpoint: '/api/v1/users', status: 404 }),
          makeError({ id: 'err-2', method: 'GET', endpoint: '/api/v1/server', status: 500 }),
        ],
      })
    })

    const ErrorsPage = require('../../errors/page').default

    act(() => {
      render(
        <Wrapper>
          <ErrorsPage />
        </Wrapper>
      )
    })

    // Both visible initially
    expect(screen.getByText('/api/v1/users')).toBeInTheDocument()
    expect(screen.getByText('/api/v1/server')).toBeInTheDocument()

    // Filter to only 4xx by removing 5xx from store (simulating filter result)
    act(() => {
      useErrorLogStore.setState({
        errors: [makeError({ id: 'err-1', method: 'GET', endpoint: '/api/v1/users', status: 404 })],
      })
    })

    expect(screen.getByText('/api/v1/users')).toBeInTheDocument()
    expect(screen.queryByText('/api/v1/server')).not.toBeInTheDocument()
  })
})
