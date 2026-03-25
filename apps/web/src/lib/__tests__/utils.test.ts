import { cn } from '../utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible')
  })

  it('deduplicates tailwind classes', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2')
  })

  it('returns empty string for no inputs', () => {
    expect(cn()).toBe('')
  })

  it('handles undefined and null values', () => {
    expect(cn('a', undefined, null, 'b')).toBe('a b')
  })

  it('handles array inputs', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar')
  })

  it('handles object inputs', () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz')
  })
})
