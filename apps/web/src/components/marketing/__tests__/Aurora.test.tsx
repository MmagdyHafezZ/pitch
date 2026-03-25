/** @jest-environment jsdom */
import React from 'react'
import { render } from '@testing-library/react'

jest.mock('ogl', () => {
  const mockCanvas = document.createElement('canvas')
  Object.assign(mockCanvas.style, { backgroundColor: '' })

  const mockGl = {
    clearColor: jest.fn(),
    enable: jest.fn(),
    blendFunc: jest.fn(),
    canvas: mockCanvas,
    ONE: 1,
    ONE_MINUS_SRC_ALPHA: 771,
    BLEND: 3042,
    getExtension: jest.fn(() => ({ loseContext: jest.fn() })),
  }

  return {
    Renderer: jest.fn(() => ({
      gl: mockGl,
      setSize: jest.fn(),
      render: jest.fn(),
    })),
    Program: jest.fn(() => ({
      uniforms: {
        uTime: { value: 0 },
        uAmplitude: { value: 0 },
        uColorStops: { value: [] },
        uResolution: { value: [0, 0] },
        uBlend: { value: 0 },
      },
    })),
    Mesh: jest.fn(),
    Color: jest.fn((hex: string) => {
      const num = parseInt(hex.replace('#', ''), 16)
      return { r: ((num >> 16) & 255) / 255, g: ((num >> 8) & 255) / 255, b: (num & 255) / 255 }
    }),
    Triangle: jest.fn(() => ({ attributes: {} })),
  }
})

import { Aurora } from '../Aurora'

describe('Aurora', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders a container div', () => {
    const { container } = render(<Aurora />)
    const div = container.firstElementChild as HTMLElement
    expect(div).toBeInTheDocument()
    expect(div.tagName).toBe('DIV')
  })

  it('has aria-hidden="true"', () => {
    const { container } = render(<Aurora />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('applies default classes', () => {
    const { container } = render(<Aurora />)
    const div = container.firstElementChild as HTMLElement
    expect(div.className).toContain('h-full')
    expect(div.className).toContain('w-full')
  })

  it('applies custom className', () => {
    const { container } = render(<Aurora className="custom-aurora" />)
    const div = container.firstElementChild as HTMLElement
    expect(div.className).toContain('custom-aurora')
  })

  it('renders with custom props without crashing', () => {
    const { container } = render(
      <Aurora
        amplitude={1.5}
        blend={0.8}
        colorStops={['#ff0000', '#00ff00', '#0000ff']}
        speed={2}
        time={100}
      />
    )
    expect(container.firstElementChild).toBeInTheDocument()
  })

  it('renders with default colorStops', () => {
    const { container } = render(<Aurora />)
    expect(container.firstElementChild).toBeInTheDocument()
  })

  it('appends canvas to the container on mount', () => {
    const { container } = render(<Aurora />)
    const div = container.firstElementChild as HTMLElement
    const canvas = div.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })
})
