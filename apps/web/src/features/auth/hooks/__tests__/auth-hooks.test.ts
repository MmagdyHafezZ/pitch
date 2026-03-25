import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '../useAuth'
import { useLoginForm, useRegisterForm } from '../useAuthForm'
import { useAuthStore } from '../../stores/auth.store'

jest.mock('../../services/auth.service', () => ({
  useLoginMutation: () => ({
    mutateAsync: jest.fn().mockResolvedValue({
      accessToken: 'token-123',
      user: { id: '1', email: 'a@b.com', name: 'Test' },
    }),
    isPending: false,
    error: null,
    reset: jest.fn(),
  }),
  useRegisterMutation: () => ({
    mutateAsync: jest.fn().mockResolvedValue({
      accessToken: 'token-456',
      user: { id: '2', email: 'new@b.com', name: 'New' },
    }),
    isPending: false,
    error: null,
    reset: jest.fn(),
  }),
  useLogoutMutation: () => ({
    mutateAsync: jest.fn().mockResolvedValue(undefined),
    isPending: false,
  }),
  useMeQuery: () => ({
    data: null,
    isLoading: false,
  }),
}))

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
}

beforeEach(() => {
  act(() => {
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    })
  })
})

describe('useAuth', () => {
  it('returns initial unauthenticated state', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeFalsy()
  })

  it('provides login function', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })
    expect(typeof result.current.login).toBe('function')
  })

  it('provides register function', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })
    expect(typeof result.current.register).toBe('function')
  })

  it('provides logout function', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })
    expect(typeof result.current.logout).toBe('function')
  })

  it('provides deleteAccount function', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })
    expect(typeof result.current.deleteAccount).toBe('function')
  })

  it('provides clearError function', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })
    expect(typeof result.current.clearError).toBe('function')
  })

  it('provides reset functions', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })
    expect(typeof result.current.resetLogin).toBe('function')
    expect(typeof result.current.resetRegister).toBe('function')
  })

  it('reflects store error state', () => {
    act(() => {
      useAuthStore.setState({ error: 'Some error' })
    })

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })
    expect(result.current.error).toBe('Some error')
  })
})

describe('useLoginForm', () => {
  it('returns form with initial empty values', () => {
    const { result } = renderHook(() => useLoginForm(), { wrapper: createWrapper() })

    expect(result.current.form.values.email).toBe('')
    expect(result.current.form.values.password).toBe('')
    expect(result.current.isLoading).toBe(false)
  })

  it('validates required email', () => {
    const { result } = renderHook(() => useLoginForm(), { wrapper: createWrapper() })

    act(() => {
      result.current.form.validate()
    })

    expect(result.current.form.errors.email).toBe('Email is required')
  })

  it('validates email format', () => {
    const { result } = renderHook(() => useLoginForm(), { wrapper: createWrapper() })

    act(() => {
      result.current.form.setFieldValue('email', 'invalid')
      result.current.form.validate()
    })

    expect(result.current.form.errors.email).toBe('Invalid email format')
  })

  it('validates required password', () => {
    const { result } = renderHook(() => useLoginForm(), { wrapper: createWrapper() })

    act(() => {
      result.current.form.validate()
    })

    expect(result.current.form.errors.password).toBe('Password is required')
  })

  it('validates password minimum length', () => {
    const { result } = renderHook(() => useLoginForm(), { wrapper: createWrapper() })

    act(() => {
      result.current.form.setFieldValue('password', '12345')
      result.current.form.validate()
    })

    expect(result.current.form.errors.password).toBe('Password must be at least 6 characters')
  })

  it('passes validation for valid data', () => {
    const { result } = renderHook(() => useLoginForm(), { wrapper: createWrapper() })

    act(() => {
      result.current.form.setFieldValue('email', 'test@example.com')
      result.current.form.setFieldValue('password', 'password123')
      result.current.form.validate()
    })

    expect(result.current.form.errors).toEqual({})
  })

  it('provides handleSubmit function', () => {
    const { result } = renderHook(() => useLoginForm(), { wrapper: createWrapper() })
    expect(typeof result.current.handleSubmit).toBe('function')
  })
})

describe('useRegisterForm', () => {
  it('returns form with initial empty values', () => {
    const { result } = renderHook(() => useRegisterForm(), { wrapper: createWrapper() })

    expect(result.current.form.values.name).toBe('')
    expect(result.current.form.values.email).toBe('')
    expect(result.current.form.values.password).toBe('')
    expect(result.current.form.values.confirmPassword).toBe('')
  })

  it('validates required name', () => {
    const { result } = renderHook(() => useRegisterForm(), { wrapper: createWrapper() })

    act(() => {
      result.current.form.validate()
    })

    expect(result.current.form.errors.name).toBe('Name is required')
  })

  it('validates name minimum length', () => {
    const { result } = renderHook(() => useRegisterForm(), { wrapper: createWrapper() })

    act(() => {
      result.current.form.setFieldValue('name', 'A')
      result.current.form.validate()
    })

    expect(result.current.form.errors.name).toBe('Name must be at least 2 characters')
  })

  it('validates confirm password required', () => {
    const { result } = renderHook(() => useRegisterForm(), { wrapper: createWrapper() })

    act(() => {
      result.current.form.validate()
    })

    expect(result.current.form.errors.confirmPassword).toBe('Please confirm your password')
  })

  it('validates passwords must match', () => {
    const { result } = renderHook(() => useRegisterForm(), { wrapper: createWrapper() })

    act(() => {
      result.current.form.setFieldValue('password', 'password123')
      result.current.form.setFieldValue('confirmPassword', 'different')
      result.current.form.validate()
    })

    expect(result.current.form.errors.confirmPassword).toBe('Passwords do not match')
  })

  it('passes validation for valid data', () => {
    const { result } = renderHook(() => useRegisterForm(), { wrapper: createWrapper() })

    act(() => {
      result.current.form.setFieldValue('name', 'Test User')
      result.current.form.setFieldValue('email', 'test@example.com')
      result.current.form.setFieldValue('password', 'password123')
      result.current.form.setFieldValue('confirmPassword', 'password123')
      result.current.form.validate()
    })

    expect(result.current.form.errors).toEqual({})
  })
})
