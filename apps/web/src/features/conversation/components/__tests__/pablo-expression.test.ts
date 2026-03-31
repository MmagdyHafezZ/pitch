import { getPabloExpressionMode, getPabloMorphState } from '../pablo-expression'

describe('pablo-expression', () => {
  it('uses the mad expression for Rude Karen and frustrated presenter states', () => {
    expect(getPabloExpressionMode({ tone: 'Rude Karen' })).toBe('mad')
    expect(getPabloExpressionMode({ tone: ' rude karen ' })).toBe('mad')
    expect(getPabloExpressionMode({ tone: 'Friendly', isFrustrated: true })).toBe('mad')
    expect(getPabloExpressionMode({ tone: 'Friendly' })).toBe('normal')
    expect(getPabloExpressionMode()).toBe('normal')
  })

  it('uses the mad mouth targets while speaking in mad mode', () => {
    expect(getPabloMorphState('mad', true)).toEqual({
      mad: 1,
      open_mouth: 0,
      open_mouth_mad: 1,
      open: 0,
      open_mad: 1,
    })
  })

  it('keeps the normal mouth targets for all non-mad expressions', () => {
    expect(getPabloMorphState('normal', true)).toEqual({
      mad: 0,
      open_mouth: 1,
      open_mouth_mad: 0,
      open: 1,
      open_mad: 0,
    })
    expect(getPabloMorphState('normal', false)).toEqual({
      mad: 0,
      open_mouth: 0,
      open_mouth_mad: 0,
      open: 0,
      open_mad: 0,
    })
  })
})
