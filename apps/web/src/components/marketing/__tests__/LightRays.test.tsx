/** @jest-environment jsdom */
import React from 'react'
import { render } from '@testing-library/react'

jest.mock('../LightRays.module.css', () => ({
  container: 'container',
}))

jest.mock('ogl', () => {
  const mockCanvas = document.createElement('canvas')
  Object.assign(mockCanvas.style, { width: '', height: '', display: '' })

  const mockGl = {
    canvas: mockCanvas,
    getExtension: jest.fn(() => ({ loseContext: jest.fn() })),
  }

  return {
    Renderer: jest.fn(() => ({
      gl: mockGl,
      dpr: 1,
      setSize: jest.fn(),
      render: jest.fn(),
    })),
    Program: jest.fn(() => ({})),
    Mesh: jest.fn(),
    Triangle: jest.fn(() => ({ attributes: {} })),
  }
})

import { LightRays } from '../LightRays'

describe('LightRays', () => {
  it('renders a container div', () => {
    const { container } = render(<LightRays />)
    const div = container.firstElementChild as HTMLElement
    expect(div).toBeInTheDocument()
    expect(div.tagName).toBe('DIV')
  })

  it('applies container CSS class', () => {
    const { container } = render(<LightRays />)
    const div = container.firstElementChild as HTMLElement
    expect(div.className).toContain('container')
  })

  it('applies custom className', () => {
    const { container } = render(<LightRays className="my-custom" />)
    const div = container.firstElementChild as HTMLElement
    expect(div.className).toContain('my-custom')
  })

  it('renders without crashing with default props', () => {
    const { container } = render(<LightRays />)
    expect(container.firstElementChild).toBeInTheDocument()
  })

  it('renders with all custom props', () => {
    const { container } = render(
      <LightRays
        raysOrigin="bottom-left"
        raysColor="#ff0000"
        raysSpeed={2}
        lightSpread={1.5}
        rayLength={3}
        pulsating={true}
        fadeDistance={0.8}
        saturation={0.5}
        followMouse={false}
        mouseInfluence={0.3}
        noiseAmount={0.2}
        distortion={0.1}
      />
    )
    expect(container.firstElementChild).toBeInTheDocument()
  })

  it('renders with each raysOrigin option', () => {
    const origins = [
      'top-left',
      'top-center',
      'top-right',
      'left',
      'right',
      'bottom-left',
      'bottom-center',
      'bottom-right',
    ] as const

    for (const origin of origins) {
      const { container, unmount } = render(<LightRays raysOrigin={origin} />)
      expect(container.firstElementChild).toBeInTheDocument()
      unmount()
    }
  })

  it('trims className when no custom class is passed', () => {
    const { container } = render(<LightRays />)
    const div = container.firstElementChild as HTMLElement
    expect(div.className).not.toMatch(/\s$/)
  })
})
