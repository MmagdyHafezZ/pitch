/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('../StarBorder.module.css', () => ({
  container: 'container',
  gradientBottom: 'gradientBottom',
  gradientTop: 'gradientTop',
  inner: 'inner',
}))

import { StarBorder } from '../StarBorder'

describe('StarBorder', () => {
  it('renders children', () => {
    render(<StarBorder>Click me</StarBorder>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('renders as a button by default', () => {
    render(<StarBorder>Action</StarBorder>)
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
  })

  it('renders as a custom element', () => {
    render(<StarBorder as="div">Content</StarBorder>)
    expect(screen.getByText('Content').closest('div')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<StarBorder className="my-class">Text</StarBorder>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('my-class')
    expect(btn.className).toContain('container')
  })

  it('applies innerClassName', () => {
    const { container } = render(<StarBorder innerClassName="inner-custom">Text</StarBorder>)
    const inner = container.querySelector('.inner') as HTMLElement
    expect(inner.className).toContain('inner-custom')
  })

  it('applies thickness as padding', () => {
    render(<StarBorder thickness={3}>Text</StarBorder>)
    const btn = screen.getByRole('button')
    expect(btn.style.padding).toMatch(/^3px\s*0/)
  })

  it('applies default thickness of 1', () => {
    render(<StarBorder>Text</StarBorder>)
    const btn = screen.getByRole('button')
    expect(btn.style.padding).toMatch(/^1px\s*0/)
  })

  it('renders gradient elements with custom color', () => {
    const { container } = render(<StarBorder color="red">Text</StarBorder>)
    const gradients = container.querySelectorAll('[class*="gradient"]')
    expect(gradients.length).toBe(2)
    gradients.forEach((el) => {
      expect((el as HTMLElement).style.background).toContain('red')
    })
  })

  it('applies custom speed to gradients', () => {
    const { container } = render(<StarBorder speed="10s">Text</StarBorder>)
    const gradients = container.querySelectorAll('[class*="gradient"]')
    gradients.forEach((el) => {
      expect((el as HTMLElement).style.animationDuration).toBe('10s')
    })
  })

  it('passes through additional props', () => {
    render(<StarBorder data-testid="star-btn">Text</StarBorder>)
    expect(screen.getByTestId('star-btn')).toBeInTheDocument()
  })

  it('merges custom style with thickness padding', () => {
    render(
      <StarBorder style={{ color: 'blue' }} thickness={2}>
        Text
      </StarBorder>
    )
    const btn = screen.getByRole('button')
    expect(btn.style.color).toBe('blue')
    expect(btn.style.padding).toMatch(/^2px\s*0/)
  })
})
