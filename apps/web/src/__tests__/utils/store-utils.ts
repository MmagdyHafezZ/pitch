import { act } from '@testing-library/react'
import { StateCreator } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import type { AuthState } from '@/features/auth/types/auth.types'
import type { AuthStore } from '@/features/auth/stores/auth.store'

/**
 * Helper to reset Zustand stores between tests
 */
export const resetStores = () => {
  act(() => {
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    })
  })
}

/**
 * Helper to create a mock auth state
 */
export const createMockAuthState = (overrides: Partial<AuthState> = {}): Partial<AuthStore> => ({
  user: {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  token: 'mock-jwt-token',
  isAuthenticated: true,
  isLoading: false,
  error: null,
  ...overrides,
})

/**
 * Helper to mock authenticated state
 */
export const mockAuthenticatedState = (overrides = {}) => {
  const mockState = createMockAuthState(overrides)
  act(() => {
    useAuthStore.setState(mockState)
  })
  return mockState
}

/**
 * Helper to mock loading state
 */
export const mockLoadingState = () => {
  act(() => {
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
    })
  })
}

/**
 * Helper to mock error state
 */
export const mockErrorState = (error = 'Something went wrong') => {
  act(() => {
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error,
    })
  })
}

/**
 * Helper to get current store state for assertions
 */
export const getAuthStoreState = () => {
  return useAuthStore.getState()
}

/**
 * Helper to create a temporary store for testing
 * This is useful for testing store logic in isolation
 */
export const createTestStore = <T>(storeCreator: StateCreator<T>) => {
  return createStore(storeCreator)
}
