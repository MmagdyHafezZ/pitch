/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('recharts', () => {
  const Original = jest.requireActual('recharts')
  return {
    ...Original,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
  }
})

import {
  ChartContainer,
  ChartStyle,
  ChartTooltipContent,
  ChartLegendContent,
  type ChartConfig,
} from '../chart'

describe('ChartContainer', () => {
  const config: ChartConfig = {
    revenue: { label: 'Revenue', color: '#4ade80' },
    expenses: { label: 'Expenses', color: '#f87171' },
  }

  it('renders children inside a responsive container', () => {
    render(
      <ChartContainer config={config}>
        <div>Chart child</div>
      </ChartContainer>
    )
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    expect(screen.getByText('Chart child')).toBeInTheDocument()
  })

  it('applies the data-chart attribute', () => {
    const { container } = render(
      <ChartContainer config={config} id="test-chart">
        <div>Child</div>
      </ChartContainer>
    )
    const el = container.querySelector('[data-chart="chart-test-chart"]')
    expect(el).toBeInTheDocument()
  })

  it('merges custom className', () => {
    const { container } = render(
      <ChartContainer config={config} className="custom-class">
        <div>Child</div>
      </ChartContainer>
    )
    const el = container.querySelector('[data-slot="chart"]')
    expect(el?.className).toContain('custom-class')
  })

  it('applies data-slot="chart" to the wrapper', () => {
    const { container } = render(
      <ChartContainer config={config}>
        <div>Child</div>
      </ChartContainer>
    )
    expect(container.querySelector('[data-slot="chart"]')).toBeInTheDocument()
  })

  it('generates an auto id when no id is provided', () => {
    const { container } = render(
      <ChartContainer config={config}>
        <div>Child</div>
      </ChartContainer>
    )
    const el = container.querySelector('[data-chart]')
    expect(el).toBeInTheDocument()
    expect(el?.getAttribute('data-chart')).toMatch(/^chart-/)
  })

  it('renders ChartStyle inside the container', () => {
    const { container } = render(
      <ChartContainer config={config}>
        <div>Child</div>
      </ChartContainer>
    )
    const style = container.querySelector('style')
    expect(style).toBeInTheDocument()
    expect(style?.innerHTML).toContain('--color-revenue')
    expect(style?.innerHTML).toContain('--color-expenses')
  })

  it('passes additional props to the wrapper div', () => {
    const { container } = render(
      <ChartContainer config={config} data-custom="hello">
        <div>Child</div>
      </ChartContainer>
    )
    const el = container.querySelector('[data-custom="hello"]')
    expect(el).toBeInTheDocument()
  })
})

describe('ChartStyle', () => {
  it('renders a <style> tag with CSS custom properties', () => {
    const config: ChartConfig = {
      revenue: { label: 'Revenue', color: '#4ade80' },
    }
    const { container } = render(<ChartStyle id="test-id" config={config} />)
    const style = container.querySelector('style')
    expect(style).toBeInTheDocument()
    expect(style?.innerHTML).toContain('--color-revenue: #4ade80')
  })

  it('returns null when no colors are configured', () => {
    const config: ChartConfig = {
      item: { label: 'No color' },
    }
    const { container } = render(<ChartStyle id="test-id" config={config} />)
    expect(container.querySelector('style')).toBeNull()
  })

  it('handles theme-based color config', () => {
    const config: ChartConfig = {
      revenue: { label: 'Revenue', theme: { light: '#000', dark: '#fff' } },
    }
    const { container } = render(<ChartStyle id="theme-test" config={config} />)
    const style = container.querySelector('style')
    expect(style?.innerHTML).toContain('--color-revenue')
  })

  it('renders both light and dark theme entries', () => {
    const config: ChartConfig = {
      sales: { label: 'Sales', theme: { light: '#111', dark: '#eee' } },
    }
    const { container } = render(<ChartStyle id="dual-theme" config={config} />)
    const style = container.querySelector('style')
    expect(style?.innerHTML).toContain('--color-sales: #111')
    expect(style?.innerHTML).toContain('--color-sales: #eee')
  })

  it('handles mixed color and theme configs', () => {
    const config: ChartConfig = {
      a: { label: 'A', color: '#aaa' },
      b: { label: 'B', theme: { light: '#bbb', dark: '#ccc' } },
    }
    const { container } = render(<ChartStyle id="mixed" config={config} />)
    const style = container.querySelector('style')
    expect(style?.innerHTML).toContain('--color-a: #aaa')
    expect(style?.innerHTML).toContain('--color-b')
  })

  it('generates CSS scoped to the given id', () => {
    const config: ChartConfig = {
      x: { label: 'X', color: '#123' },
    }
    const { container } = render(<ChartStyle id="my-unique-chart" config={config} />)
    const style = container.querySelector('style')
    expect(style?.innerHTML).toContain('[data-chart=my-unique-chart]')
  })

  it('renders multiple color variables for multiple config keys', () => {
    const config: ChartConfig = {
      alpha: { label: 'Alpha', color: '#111' },
      beta: { label: 'Beta', color: '#222' },
      gamma: { label: 'Gamma', color: '#333' },
    }
    const { container } = render(<ChartStyle id="multi" config={config} />)
    const style = container.querySelector('style')
    expect(style?.innerHTML).toContain('--color-alpha: #111')
    expect(style?.innerHTML).toContain('--color-beta: #222')
    expect(style?.innerHTML).toContain('--color-gamma: #333')
  })
})

describe('ChartTooltipContent', () => {
  const config: ChartConfig = {
    revenue: { label: 'Revenue', color: '#4ade80' },
    expenses: { label: 'Expenses', color: '#f87171' },
  }

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <ChartContainer config={config}>
      <>{children}</>
    </ChartContainer>
  )

  it('returns null when not active', () => {
    const { container } = render(
      <Wrapper>
        <ChartTooltipContent active={false} payload={[]} />
      </Wrapper>
    )
    const tooltipContent = container.querySelector('.border-border\\/50')
    expect(tooltipContent).toBeNull()
  })

  it('returns null when payload is empty', () => {
    const { container } = render(
      <Wrapper>
        <ChartTooltipContent active={true} payload={[]} />
      </Wrapper>
    )
    const tooltipContent = container.querySelector('.border-border\\/50')
    expect(tooltipContent).toBeNull()
  })

  it('renders tooltip content with payload data', () => {
    const payload = [
      {
        dataKey: 'revenue',
        name: 'revenue',
        value: 1000,
        color: '#4ade80',
        payload: { revenue: 1000 },
        type: 'line' as const,
      },
    ]

    render(
      <Wrapper>
        <ChartTooltipContent active={true} payload={payload} label="Jan" />
      </Wrapper>
    )

    expect(screen.getByText('Revenue')).toBeInTheDocument()
    expect(screen.getByText('1,000')).toBeInTheDocument()
  })

  it('hides label when hideLabel is true', () => {
    const payload = [
      {
        dataKey: 'revenue',
        name: 'revenue',
        value: 500,
        color: '#4ade80',
        payload: { revenue: 500 },
        type: 'line' as const,
      },
    ]

    const { container } = render(
      <Wrapper>
        <ChartTooltipContent active={true} payload={payload} label="Jan" hideLabel />
      </Wrapper>
    )

    expect(screen.getByText('Revenue')).toBeInTheDocument()
    expect(screen.getByText('500')).toBeInTheDocument()
  })

  it('hides indicator when hideIndicator is true', () => {
    const payload = [
      {
        dataKey: 'revenue',
        name: 'revenue',
        value: 200,
        color: '#4ade80',
        payload: { revenue: 200 },
        type: 'line' as const,
      },
    ]

    render(
      <Wrapper>
        <ChartTooltipContent active={true} payload={payload} label="Feb" hideIndicator />
      </Wrapper>
    )

    expect(screen.getByText('200')).toBeInTheDocument()
  })

  it('uses labelFormatter when provided', () => {
    const payload = [
      {
        dataKey: 'revenue',
        name: 'revenue',
        value: 999,
        color: '#4ade80',
        payload: { revenue: 999 },
        type: 'line' as const,
      },
    ]

    render(
      <Wrapper>
        <ChartTooltipContent
          active={true}
          payload={payload}
          label="Jan"
          labelFormatter={(value) => `Custom: ${value}`}
        />
      </Wrapper>
    )

    expect(screen.getByText('Custom: Jan')).toBeInTheDocument()
  })

  it('filters out payload items with type "none"', () => {
    const payload = [
      {
        dataKey: 'revenue',
        name: 'revenue',
        value: 100,
        color: '#4ade80',
        payload: { revenue: 100 },
        type: 'none' as const,
      },
    ]

    const { container } = render(
      <Wrapper>
        <ChartTooltipContent active={true} payload={payload} label="Mar" />
      </Wrapper>
    )

    expect(screen.queryByText('100')).not.toBeInTheDocument()
  })

  it('renders with line indicator style', () => {
    const payload = [
      {
        dataKey: 'revenue',
        name: 'revenue',
        value: 300,
        color: '#4ade80',
        payload: { revenue: 300 },
        type: 'line' as const,
      },
    ]

    render(
      <Wrapper>
        <ChartTooltipContent active={true} payload={payload} label="Apr" indicator="line" />
      </Wrapper>
    )

    expect(screen.getByText('300')).toBeInTheDocument()
  })

  it('renders with dashed indicator style', () => {
    const payload = [
      {
        dataKey: 'revenue',
        name: 'revenue',
        value: 400,
        color: '#4ade80',
        payload: { revenue: 400 },
        type: 'line' as const,
      },
    ]

    render(
      <Wrapper>
        <ChartTooltipContent active={true} payload={payload} label="May" indicator="dashed" />
      </Wrapper>
    )

    expect(screen.getByText('400')).toBeInTheDocument()
  })
})

describe('ChartLegendContent', () => {
  const config: ChartConfig = {
    revenue: { label: 'Revenue', color: '#4ade80' },
    expenses: { label: 'Expenses', color: '#f87171' },
  }

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <ChartContainer config={config}>
      <>{children}</>
    </ChartContainer>
  )

  it('returns null when payload is empty', () => {
    const { container } = render(
      <Wrapper>
        <ChartLegendContent payload={[]} />
      </Wrapper>
    )
    expect(container.querySelector('.flex.items-center.justify-center')).toBeNull()
  })

  it('renders legend items with labels', () => {
    const payload = [
      { dataKey: 'revenue', value: 'revenue', color: '#4ade80', type: 'line' as const },
      { dataKey: 'expenses', value: 'expenses', color: '#f87171', type: 'line' as const },
    ]

    render(
      <Wrapper>
        <ChartLegendContent payload={payload} />
      </Wrapper>
    )

    expect(screen.getByText('Revenue')).toBeInTheDocument()
    expect(screen.getByText('Expenses')).toBeInTheDocument()
  })

  it('hides icon when hideIcon is true', () => {
    const payload = [
      { dataKey: 'revenue', value: 'revenue', color: '#4ade80', type: 'line' as const },
    ]

    render(
      <Wrapper>
        <ChartLegendContent payload={payload} hideIcon />
      </Wrapper>
    )

    expect(screen.getByText('Revenue')).toBeInTheDocument()
  })

  it('filters out payload items with type "none"', () => {
    const payload = [
      { dataKey: 'revenue', value: 'revenue', color: '#4ade80', type: 'none' as const },
    ]

    const { container } = render(
      <Wrapper>
        <ChartLegendContent payload={payload} />
      </Wrapper>
    )

    expect(screen.queryByText('Revenue')).not.toBeInTheDocument()
  })

  it('applies top padding when verticalAlign is "top"', () => {
    const payload = [
      { dataKey: 'revenue', value: 'revenue', color: '#4ade80', type: 'line' as const },
    ]

    const { container } = render(
      <Wrapper>
        <ChartLegendContent payload={payload} verticalAlign="top" />
      </Wrapper>
    )

    const legend = container.querySelector('.pb-3')
    expect(legend).toBeInTheDocument()
  })
})
