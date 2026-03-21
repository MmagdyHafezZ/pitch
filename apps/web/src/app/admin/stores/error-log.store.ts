import { create } from 'zustand'
import { setApiErrorListener } from '@/lib/client'

export type ApiError = {
  id: string
  timestamp: string
  method: string
  endpoint: string
  status: number
  message: string
}

type ErrorLogState = {
  errors: ApiError[]
  addError: (error: Omit<ApiError, 'id'>) => void
  removeError: (id: string) => void
  clearErrors: () => void
}

const MAX_ERRORS = 200

export const useErrorLogStore = create<ErrorLogState>((set) => ({
  errors: [],
  addError: (error) =>
    set((state) => {
      const newError: ApiError = {
        ...error,
        id:
          typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).slice(2),
      }
      const errors = [newError, ...state.errors]
      return { errors: errors.slice(0, MAX_ERRORS) }
    }),
  removeError: (id) => set((state) => ({ errors: state.errors.filter((e) => e.id !== id) })),
  clearErrors: () => set({ errors: [] }),
}))

let interceptorInitialized = false

export const initializeErrorInterceptor = () => {
  if (interceptorInitialized) return
  interceptorInitialized = true
  setApiErrorListener((error) => {
    useErrorLogStore.getState().addError(error)
  })
}
