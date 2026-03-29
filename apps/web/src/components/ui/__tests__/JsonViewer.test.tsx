/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { JsonViewer } from '../JsonViewer'

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MantineProvider>{children}</MantineProvider>
}

describe('JsonViewer', () => {
  it('renders key-value pairs from a flat object', () => {
    render(<JsonViewer data={{ name: 'Alice', age: 30 }} />, { wrapper: Wrapper })
    expect(screen.getByText('name:')).toBeInTheDocument()
    expect(screen.getByText('"Alice"')).toBeInTheDocument()
    expect(screen.getByText('age:')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
  })

  it('renders nested objects as stringified JSON', () => {
    render(<JsonViewer data={{ config: { retries: 3 } }} />, { wrapper: Wrapper })
    expect(screen.getByText('config:')).toBeInTheDocument()
    expect(screen.getByText(/retries/)).toBeInTheDocument()
  })

  it('renders array values as stringified JSON', () => {
    render(<JsonViewer data={{ tags: ['a', 'b'] }} />, { wrapper: Wrapper })
    expect(screen.getByText('tags:')).toBeInTheDocument()
    expect(screen.getByText(/\[/)).toBeInTheDocument()
  })

  it('renders boolean values', () => {
    render(<JsonViewer data={{ enabled: true }} />, { wrapper: Wrapper })
    expect(screen.getByText('enabled:')).toBeInTheDocument()
    expect(screen.getByText('true')).toBeInTheDocument()
  })

  it('renders null values', () => {
    render(<JsonViewer data={{ value: null }} />, { wrapper: Wrapper })
    expect(screen.getByText('value:')).toBeInTheDocument()
    expect(screen.getByText('null')).toBeInTheDocument()
  })

  it('renders an empty object without crashing', () => {
    const { container } = render(<JsonViewer data={{}} />, { wrapper: Wrapper })
    expect(container).toBeInTheDocument()
  })
})
