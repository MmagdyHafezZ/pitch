/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'

jest.mock('next/font/google', () => ({
  Space_Grotesk: () => ({ variable: '--font-heading' }),
  Manrope: () => ({ variable: '--font-body' }),
}))

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    const { fill, ...rest } = props
    return <img {...rest} />
  },
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

jest.mock('@/components/marketing/Counter', () => ({
  Counter: ({ value, suffix }: { value: number; suffix?: string }) => (
    <span data-testid="counter">
      {value}
      {suffix}
    </span>
  ),
}))

jest.mock('@/components/marketing/PillNav', () => ({
  PillNav: ({ items }: { items: Array<{ href: string; label: string }> }) => (
    <nav data-testid="pill-nav">
      {items.map((item) => (
        <a key={item.href} href={item.href}>
          {item.label}
        </a>
      ))}
    </nav>
  ),
}))

jest.mock('@/components/marketing/StarBorder', () => ({
  StarBorder: ({ children, as: As = 'div', ...rest }: any) => (
    <As data-testid="star-border" {...rest}>
      {children}
    </As>
  ),
}))

jest.mock('../LandingBackground', () => ({
  LandingBackground: () => <div data-testid="landing-bg" />,
}))

import Home from '../page'

describe('Landing Page (Home)', () => {
  beforeEach(() => {
    render(<Home />)
  })

  it('renders the brand name', () => {
    const brandLinks = screen.getAllByText('PITCH')
    expect(brandLinks.length).toBeGreaterThan(0)
  })

  it('renders the hero heading', () => {
    expect(screen.getByText(/AI sales rehearsal for teams/)).toBeInTheDocument()
  })

  it('renders hero signals', () => {
    expect(screen.getByText('Realistic buyer personas')).toBeInTheDocument()
    expect(screen.getByText('Live coaching insights')).toBeInTheDocument()
    expect(screen.getByText('Manager-ready reporting')).toBeInTheDocument()
  })

  it('renders hero stats counters', () => {
    const counters = screen.getAllByTestId('counter')
    expect(counters.length).toBe(4)
  })

  it('renders the LandingBackground', () => {
    expect(screen.getByTestId('landing-bg')).toBeInTheDocument()
  })

  it('renders PillNav with links', () => {
    expect(screen.getByTestId('pill-nav')).toBeInTheDocument()
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getAllByText('The Team').length).toBeGreaterThan(0)
  })

  it('renders Problem section', () => {
    expect(
      screen.getByText('Sales coaching still breaks down when teams try to scale it')
    ).toBeInTheDocument()
    expect(screen.getByText('Ramp-up takes too long')).toBeInTheDocument()
    expect(screen.getByText('Coaching quality varies')).toBeInTheDocument()
    expect(screen.getByText('Readiness is hard to prove')).toBeInTheDocument()
  })

  it('renders Solution section', () => {
    expect(screen.getByText('One workflow for practice, coaching, and review')).toBeInTheDocument()
    expect(screen.getByText('Realistic AI buyer personas')).toBeInTheDocument()
    expect(screen.getByText('Live coaching signals')).toBeInTheDocument()
  })

  it('renders workflow steps', () => {
    expect(screen.getByText('Set the scenario')).toBeInTheDocument()
    expect(screen.getByText('Run the rehearsal')).toBeInTheDocument()
    expect(screen.getByText('Review and coach')).toBeInTheDocument()
  })

  it('renders Analytics section', () => {
    expect(
      screen.getByText('Reporting that shows whether coaching is actually working')
    ).toBeInTheDocument()
  })

  it('renders Examples section', () => {
    expect(screen.getByText('Leadership dashboard')).toBeInTheDocument()
    expect(screen.getByText('Live practice session')).toBeInTheDocument()
    expect(screen.getByText('Scenario setup')).toBeInTheDocument()
  })

  it('renders Team section', () => {
    expect(
      screen.getByText('Built by a six-student team with IBM-backed sponsorship')
    ).toBeInTheDocument()
    expect(screen.getByText('IBM Sponsored')).toBeInTheDocument()
    expect(screen.getByText('University of Calgary')).toBeInTheDocument()
    expect(screen.getByText('6-Student Delivery Team')).toBeInTheDocument()
  })

  it('renders team pods', () => {
    expect(screen.getByText('Product Strategy')).toBeInTheDocument()
    expect(screen.getByText('Frontend Experience')).toBeInTheDocument()
    expect(screen.getByText('Backend Architecture')).toBeInTheDocument()
    expect(screen.getByText('AI and Prompt Systems')).toBeInTheDocument()
  })

  it('renders GitHub section with links', () => {
    expect(screen.getByText('See the code, architecture, and delivery history')).toBeInTheDocument()
  })

  it('renders the SVG readiness trend chart', () => {
    expect(
      screen.getByRole('img', { name: /Readiness and confidence trend chart/ })
    ).toBeInTheDocument()
  })

  it('renders register and GitHub navigation links', () => {
    const registerLinks = screen.getAllByRole('link', { name: /Request a walkthrough/ })
    expect(registerLinks.length).toBeGreaterThan(0)
    expect(registerLinks[0]).toHaveAttribute('href', '/auth/register')

    const githubLinks = screen.getAllByRole('link', { name: /View Source/ })
    expect(githubLinks.length).toBeGreaterThan(0)
  })

  it('renders the footer with copyright', () => {
    const year = new Date().getFullYear()
    expect(screen.getByText(`© ${year} PITCH`)).toBeInTheDocument()
    expect(screen.getByText('IBM-sponsored University of Calgary capstone')).toBeInTheDocument()
  })

  it('renders improvement bars', () => {
    expect(screen.getByText('Discovery Quality')).toBeInTheDocument()
    expect(screen.getByText('Narrative Clarity')).toBeInTheDocument()
    expect(screen.getByText('Objection Handling')).toBeInTheDocument()
  })
})
