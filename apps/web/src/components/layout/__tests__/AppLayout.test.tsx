/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'

jest.mock('../app-layout.module.css', () => ({
  surface: 'surface',
  mesh: 'mesh',
  glowOrb: 'glowOrb',
  orbA: 'orbA',
  orbB: 'orbB',
  content: 'content',
}))

import { AppLayout } from '../AppLayout'

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MantineProvider>{children}</MantineProvider>
}

describe('AppLayout', () => {
  it('renders children content', () => {
    render(
      <AppLayout header={<div>Header</div>} navbar={<div>Navbar</div>}>
        <p>Main content</p>
      </AppLayout>,
      { wrapper: Wrapper }
    )
    expect(screen.getByText('Main content')).toBeInTheDocument()
  })

  it('renders static header and navbar', () => {
    render(
      <AppLayout header={<div>My Header</div>} navbar={<div>My Navbar</div>}>
        <p>Body</p>
      </AppLayout>,
      { wrapper: Wrapper }
    )
    expect(screen.getByText('My Header')).toBeInTheDocument()
    expect(screen.getByText('My Navbar')).toBeInTheDocument()
  })

  it('renders function-based header slot receiving ShellControls', () => {
    render(
      <AppLayout
        header={(controls) => (
          <div>
            <span>Fn Header</span>
            <span data-testid="mobile-opened">{String(controls.mobileNavOpened)}</span>
          </div>
        )}
        navbar={<div>Nav</div>}
      >
        <p>Body</p>
      </AppLayout>,
      { wrapper: Wrapper }
    )
    expect(screen.getByText('Fn Header')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-opened')).toHaveTextContent('false')
  })

  it('renders function-based navbar slot receiving ShellControls', () => {
    render(
      <AppLayout
        header={<div>Header</div>}
        navbar={(controls) => (
          <div>
            <span>Fn Navbar</span>
            <button onClick={controls.toggleMobileNav}>Toggle</button>
          </div>
        )}
      >
        <p>Body</p>
      </AppLayout>,
      { wrapper: Wrapper }
    )
    expect(screen.getByText('Fn Navbar')).toBeInTheDocument()
    expect(screen.getByText('Toggle')).toBeInTheDocument()
  })
})
