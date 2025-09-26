import { setupServer } from 'msw/node'
import { handlers } from './handlers'

// Setup requests interception using the given handlers
export const server = setupServer(...handlers)

// Extend expect matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R
      toHaveClass(className: string): R
      toBeVisible(): R
      toBeDisabled(): R
      toBeEnabled(): R
      toHaveFocus(): R
      toHaveValue(value: string | number | string[]): R
      toHaveTextContent(text: string): R
      toHaveAttribute(attr: string, value?: string): R
    }
  }
}
