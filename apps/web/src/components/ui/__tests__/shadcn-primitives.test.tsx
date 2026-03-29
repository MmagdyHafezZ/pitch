/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { Badge } from '../badge'
import { Button } from '../button'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from '../card'
import { Progress } from '../progress'

describe('Badge', () => {
  it('renders with default variant', () => {
    render(<Badge>New</Badge>)
    expect(screen.getByText('New')).toBeInTheDocument()
    expect(screen.getByText('New').closest('[data-slot="badge"]')).toBeInTheDocument()
  })

  it('renders with secondary variant', () => {
    render(<Badge variant="secondary">Beta</Badge>)
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('renders with destructive variant', () => {
    render(<Badge variant="destructive">Error</Badge>)
    expect(screen.getByText('Error')).toBeInTheDocument()
  })

  it('renders with outline variant', () => {
    render(<Badge variant="outline">Draft</Badge>)
    expect(screen.getByText('Draft')).toBeInTheDocument()
  })

  it('accepts custom className', () => {
    render(<Badge className="custom">Tag</Badge>)
    expect(screen.getByText('Tag').className).toContain('custom')
  })

  it('renders as child element when asChild', () => {
    render(
      <Badge asChild>
        <a href="/link">Link Badge</a>
      </Badge>
    )
    const link = screen.getByText('Link Badge')
    expect(link.tagName).toBe('A')
  })
})

describe('Button', () => {
  it('renders with default variant and size', () => {
    render(<Button>Click me</Button>)
    const btn = screen.getByText('Click me')
    expect(btn.closest('[data-slot="button"]')).toBeInTheDocument()
  })

  it('renders with destructive variant', () => {
    render(<Button variant="destructive">Delete</Button>)
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('renders with outline variant', () => {
    render(<Button variant="outline">Cancel</Button>)
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('renders with sm size', () => {
    render(<Button size="sm">Small</Button>)
    expect(screen.getByText('Small')).toBeInTheDocument()
  })

  it('renders with lg size', () => {
    render(<Button size="lg">Large</Button>)
    expect(screen.getByText('Large')).toBeInTheDocument()
  })

  it('renders disabled state', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByText('Disabled').closest('button')).toBeDisabled()
  })

  it('renders as child element when asChild', () => {
    render(
      <Button asChild>
        <a href="/nav">Nav Link</a>
      </Button>
    )
    expect(screen.getByText('Nav Link').tagName).toBe('A')
  })
})

describe('Card', () => {
  it('renders Card with data-slot', () => {
    render(<Card>Content</Card>)
    expect(screen.getByText('Content').closest('[data-slot="card"]')).toBeInTheDocument()
  })

  it('renders CardHeader', () => {
    render(<CardHeader>Header</CardHeader>)
    expect(screen.getByText('Header').closest('[data-slot="card-header"]')).toBeInTheDocument()
  })

  it('renders CardTitle', () => {
    render(<CardTitle>Title</CardTitle>)
    expect(screen.getByText('Title').closest('[data-slot="card-title"]')).toBeInTheDocument()
  })

  it('renders CardDescription', () => {
    render(<CardDescription>Desc</CardDescription>)
    expect(screen.getByText('Desc').closest('[data-slot="card-description"]')).toBeInTheDocument()
  })

  it('renders CardContent', () => {
    render(<CardContent>Body</CardContent>)
    expect(screen.getByText('Body').closest('[data-slot="card-content"]')).toBeInTheDocument()
  })

  it('renders CardFooter', () => {
    render(<CardFooter>Footer</CardFooter>)
    expect(screen.getByText('Footer').closest('[data-slot="card-footer"]')).toBeInTheDocument()
  })

  it('renders CardAction', () => {
    render(<CardAction>Action</CardAction>)
    expect(screen.getByText('Action').closest('[data-slot="card-action"]')).toBeInTheDocument()
  })

  it('accepts custom className on Card', () => {
    const { container } = render(<Card className="my-card">X</Card>)
    expect(container.firstChild).toHaveClass('my-card')
  })
})

describe('Progress', () => {
  it('renders with data-slot', () => {
    const { container } = render(<Progress value={50} />)
    expect(container.querySelector('[data-slot="progress"]')).toBeInTheDocument()
  })

  it('renders the indicator with correct transform', () => {
    const { container } = render(<Progress value={75} />)
    const indicator = container.querySelector('[data-slot="progress-indicator"]') as HTMLElement
    expect(indicator.style.transform).toBe('translateX(-25%)')
  })

  it('handles 0 value', () => {
    const { container } = render(<Progress value={0} />)
    const indicator = container.querySelector('[data-slot="progress-indicator"]') as HTMLElement
    expect(indicator.style.transform).toBe('translateX(-100%)')
  })

  it('handles 100 value', () => {
    const { container } = render(<Progress value={100} />)
    const indicator = container.querySelector('[data-slot="progress-indicator"]') as HTMLElement
    expect(indicator.style.transform).toBe('translateX(-0%)')
  })

  it('handles undefined value (defaults to 0)', () => {
    const { container } = render(<Progress />)
    const indicator = container.querySelector('[data-slot="progress-indicator"]') as HTMLElement
    expect(indicator.style.transform).toBe('translateX(-100%)')
  })

  it('accepts custom className', () => {
    const { container } = render(<Progress value={50} className="my-progress" />)
    expect(container.querySelector('[data-slot="progress"]')).toHaveClass('my-progress')
  })
})
