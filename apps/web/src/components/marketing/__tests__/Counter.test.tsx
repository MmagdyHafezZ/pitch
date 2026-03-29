/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('../Counter.module.css', () => ({
  wrapper: 'wrapper',
  srOnly: 'srOnly',
  affix: 'affix',
  value: 'value',
}))

let motionEventCallback: ((v: number) => void) | null = null

const mockSpring = {
  set: jest.fn(),
  jump: jest.fn(),
  on: jest.fn(() => jest.fn()),
  get: jest.fn(() => 0),
  destroy: jest.fn(),
}

jest.mock('framer-motion', () => ({
  useSpring: jest.fn((_initialValue: number) => mockSpring),
  useMotionValueEvent: jest.fn((_mv, _event, cb) => {
    motionEventCallback = cb
  }),
  useReducedMotion: () => true,
}))

import { Counter } from '../Counter'

describe('Counter', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    motionEventCallback = null
    mockSpring.get.mockReturnValue(0)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders with a value', () => {
    render(<Counter value={42} />)
    expect(screen.getAllByText('42').length).toBeGreaterThanOrEqual(1)
  })

  it('renders accessible value with prefix and suffix', () => {
    render(<Counter value={1234} prefix="$" suffix="+" />)
    expect(screen.getAllByText('$1,234+').length).toBeGreaterThanOrEqual(1)
  })

  it('renders prefix element when provided', () => {
    render(<Counter value={100} prefix="$" />)
    const prefixEls = screen.getAllByText('$')
    expect(prefixEls.length).toBeGreaterThanOrEqual(1)
  })

  it('renders suffix element when provided', () => {
    render(<Counter value={100} suffix="/mo" />)
    const suffixEls = screen.getAllByText('/mo')
    expect(suffixEls.length).toBeGreaterThanOrEqual(1)
  })

  it('does not render prefix/suffix when empty', () => {
    const { container } = render(<Counter value={5} />)
    const affixes = container.querySelectorAll('.affix')
    expect(affixes.length).toBe(0)
  })

  it('applies custom className', () => {
    const { container } = render(<Counter value={0} className="custom" />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toContain('custom')
    expect(wrapper.className).toContain('wrapper')
  })

  it('applies fontSize style', () => {
    const { container } = render(<Counter value={10} fontSize={48} />)
    const valueSpan = container.querySelector('.value') as HTMLElement
    expect(valueSpan.style.fontSize).toBe('48px')
  })

  it('renders sr-only value without grouping', () => {
    render(<Counter value={1234567} grouping={false} />)
    expect(screen.getAllByText('1234567').length).toBeGreaterThanOrEqual(1)
  })

  it('applies containerStyle', () => {
    const { container } = render(<Counter value={0} containerStyle={{ marginTop: '10px' }} />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.style.marginTop).toBe('10px')
  })

  it('renders with decimals in sr-only text', () => {
    render(<Counter value={3.14} decimals={2} />)
    expect(screen.getAllByText('3.14').length).toBeGreaterThanOrEqual(1)
  })

  it('applies textColor style', () => {
    const { container } = render(<Counter value={0} textColor="red" />)
    const valueSpan = container.querySelector('.value') as HTMLElement
    expect(valueSpan.style.color).toBe('red')
  })
})
