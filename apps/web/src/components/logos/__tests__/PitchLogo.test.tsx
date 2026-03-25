/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import PitchLogo from '../PitchLogo'

describe('PitchLogo', () => {
  it('renders an SVG element', () => {
    const { container } = render(<PitchLogo />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('applies default className', () => {
    const { container } = render(<PitchLogo />)
    const outer = container.firstElementChild as HTMLElement
    expect(outer.className).toContain('w-8')
    expect(outer.className).toContain('h-8')
  })

  it('applies custom className', () => {
    const { container } = render(<PitchLogo className="w-16 h-16" />)
    const outer = container.firstElementChild as HTMLElement
    expect(outer.className).toContain('w-16')
    expect(outer.className).toContain('h-16')
  })

  it('contains a gradient definition', () => {
    const { container } = render(<PitchLogo />)
    const gradient = container.querySelector('linearGradient')
    expect(gradient).toBeInTheDocument()
    expect(gradient?.id).toBe('gradient')
  })

  it('has correct viewBox', () => {
    const { container } = render(<PitchLogo />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('viewBox', '0 0 32 32')
  })
})
