import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { ModalsProvider } from '@mantine/modals'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Import Mantine CSS for testing
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'

interface TestProvidersProps {
  children: React.ReactNode
  queryClient?: QueryClient
}

function TestProviders({ children, queryClient }: TestProvidersProps) {
  // Create a fresh QueryClient for each test if none provided
  const defaultQueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
    logger: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
  })

  const client = queryClient || defaultQueryClient

  return (
    <QueryClientProvider client={client}>
      <MantineProvider defaultColorScheme="light">
        <ModalsProvider>
          <Notifications />
          {children}
        </ModalsProvider>
      </MantineProvider>
    </QueryClientProvider>
  )
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient
}

const customRender = (ui: ReactElement, options?: CustomRenderOptions) => {
  const { queryClient, ...restOptions } = options || {}

  return render(ui, {
    wrapper: ({ children }) => <TestProviders queryClient={queryClient}>{children}</TestProviders>,
    ...restOptions,
  })
}

export * from '@testing-library/react'
export { customRender as render, TestProviders }

// Helper to create a mock QueryClient
export const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        staleTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
    logger: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
  })
}

// Helper to wait for async operations
export const waitForAsync = () => new Promise((resolve) => setTimeout(resolve, 0))
