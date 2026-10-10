import { describe, expect, it } from 'vitest'
import { holdsSeat } from '../team-plan'

describe('holdsSeat', () => {
  const order = ['a', 'b', 'c', 'd', 'e', 'f']

  it('covers the first members up to the seat limit', () => {
    expect(holdsSeat('e', order, 5)).toBe(true)
    expect(holdsSeat('f', order, 5)).toBe(false)
  })

  it('counts a person in several of the owner’s teams once', () => {
    expect(holdsSeat('f', ['a', 'b', 'a', 'c', 'b', 'd', 'e', 'f'], 6)).toBe(true)
  })

  it('covers everyone on unlimited plans and nobody without seats', () => {
    expect(holdsSeat('f', order, -1)).toBe(true)
    expect(holdsSeat('a', order, 0)).toBe(false)
  })

  it('does not cover people outside the owner’s teams', () => {
    expect(holdsSeat('z', order, 5)).toBe(false)
  })
})
