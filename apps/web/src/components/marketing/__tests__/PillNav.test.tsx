/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

jest.mock('../PillNav.module.css', () => ({
  container: 'container',
  nav: 'nav',
  desktopItems: 'desktopItems',
  list: 'list',
  item: 'item',
  pill: 'pill',
  pillActive: 'pillActive',
  hoverCircle: 'hoverCircle',
  labelStack: 'labelStack',
  label: 'label',
  labelHover: 'labelHover',
  mobileButton: 'mobileButton',
  mobileButtonOpen: 'mobileButtonOpen',
  mobileButtonLines: 'mobileButtonLines',
  mobileLine: 'mobileLine',
  mobilePopover: 'mobilePopover',
  mobileList: 'mobileList',
  mobileLink: 'mobileLink',
  mobileLinkActive: 'mobileLinkActive',
}))

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => false,
}))

import { PillNav } from '../PillNav'

const mockItems = [
  { href: '#features', label: 'Features' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#about', label: 'About', ariaLabel: 'About us section' },
]

describe('PillNav', () => {
  it('renders all navigation items', () => {
    render(<PillNav items={mockItems} />)
    expect(screen.getAllByText('Features').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Pricing').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('About').length).toBeGreaterThanOrEqual(1)
  })

  it('renders a nav element with aria-label', () => {
    render(<PillNav items={mockItems} />)
    expect(screen.getByRole('navigation', { name: 'Landing sections' })).toBeInTheDocument()
  })

  it('sets aria-current on the first item by default', () => {
    render(<PillNav items={mockItems} />)
    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAttribute('aria-current', 'location')
    expect(links[1]).not.toHaveAttribute('aria-current')
  })

  it('uses ariaLabel when provided', () => {
    render(<PillNav items={mockItems} />)
    const aboutLink = screen.getByRole('link', { name: 'About us section' })
    expect(aboutLink).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<PillNav items={mockItems} className="extra" />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toContain('extra')
    expect(wrapper.className).toContain('container')
  })

  it('renders a mobile menu button', () => {
    render(<PillNav items={mockItems} />)
    const btn = screen.getByRole('button', { name: /section menu/i })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('aria-expanded', 'false')
  })

  it('toggles mobile menu on button click', async () => {
    const user = userEvent.setup()
    render(<PillNav items={mockItems} />)

    const btn = screen.getByRole('button', { name: /section menu/i })
    await user.click(btn)
    expect(btn).toHaveAttribute('aria-expanded', 'true')
    expect(btn).toHaveAttribute('aria-label', 'Close section menu')
  })

  it('closes mobile menu when item is clicked', async () => {
    const user = userEvent.setup()
    render(<PillNav items={mockItems} />)

    const btn = screen.getByRole('button', { name: /section menu/i })
    await user.click(btn)

    const mobileLinks = screen.getAllByRole('link', { name: 'Pricing' })
    const mobileLink = mobileLinks[mobileLinks.length - 1]
    await user.click(mobileLink)

    expect(btn).toHaveAttribute('aria-expanded', 'false')
  })

  it('updates active href on desktop item click', async () => {
    const user = userEvent.setup()
    render(<PillNav items={mockItems} />)

    const links = screen.getAllByRole('link', { name: 'Pricing' })
    await user.click(links[0])

    expect(links[0]).toHaveAttribute('aria-current', 'location')
  })

  it('renders without items', () => {
    render(<PillNav items={[]} />)
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })
})
