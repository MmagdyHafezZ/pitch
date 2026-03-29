/** @jest-environment jsdom */
import React from 'react'
import { render } from '@testing-library/react'

jest.mock('../page.module.css', () => ({
  backgroundScene: 'backgroundScene',
  backgroundBase: 'backgroundBase',
  backgroundAuroraField: 'backgroundAuroraField',
  backgroundAuroraPrimary: 'backgroundAuroraPrimary',
  backgroundAuroraSecondary: 'backgroundAuroraSecondary',
  backgroundGlowTop: 'backgroundGlowTop',
  backgroundGlowBottom: 'backgroundGlowBottom',
  backgroundGrid: 'backgroundGrid',
  backgroundVignette: 'backgroundVignette',
}))

jest.mock('@/components/marketing/Aurora', () => ({
  Aurora: ({ className }: { className?: string }) => (
    <div data-testid="aurora" className={className} />
  ),
}))

import { LandingBackground } from '../LandingBackground'

describe('LandingBackground', () => {
  it('renders the background scene container', () => {
    const { container } = render(<LandingBackground />)
    const scene = container.firstElementChild as HTMLElement
    expect(scene).toBeInTheDocument()
    expect(scene.className).toContain('backgroundScene')
  })

  it('has aria-hidden="true"', () => {
    const { container } = render(<LandingBackground />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders two Aurora components', () => {
    const { getAllByTestId } = render(<LandingBackground />)
    const auroras = getAllByTestId('aurora')
    expect(auroras).toHaveLength(2)
  })

  it('renders primary aurora with correct class', () => {
    const { getAllByTestId } = render(<LandingBackground />)
    const auroras = getAllByTestId('aurora')
    expect(auroras[0].className).toContain('backgroundAuroraPrimary')
  })

  it('renders secondary aurora with correct class', () => {
    const { getAllByTestId } = render(<LandingBackground />)
    const auroras = getAllByTestId('aurora')
    expect(auroras[1].className).toContain('backgroundAuroraSecondary')
  })

  it('renders all background layers', () => {
    const { container } = render(<LandingBackground />)
    expect(container.querySelector('.backgroundBase')).toBeInTheDocument()
    expect(container.querySelector('.backgroundAuroraField')).toBeInTheDocument()
    expect(container.querySelector('.backgroundGlowTop')).toBeInTheDocument()
    expect(container.querySelector('.backgroundGlowBottom')).toBeInTheDocument()
    expect(container.querySelector('.backgroundGrid')).toBeInTheDocument()
    expect(container.querySelector('.backgroundVignette')).toBeInTheDocument()
  })

  it('sets CSS custom properties for scroll fade', () => {
    const { container } = render(<LandingBackground />)
    const scene = container.firstElementChild as HTMLElement
    expect(scene.style.getPropertyValue('--background-base-opacity')).toBeTruthy()
    expect(scene.style.getPropertyValue('--background-aurora-primary-opacity')).toBeTruthy()
    expect(scene.style.getPropertyValue('--background-aurora-secondary-opacity')).toBeTruthy()
    expect(scene.style.getPropertyValue('--background-glow-opacity')).toBeTruthy()
    expect(scene.style.getPropertyValue('--background-grid-opacity')).toBeTruthy()
    expect(scene.style.getPropertyValue('--background-vignette-opacity')).toBeTruthy()
  })
})
