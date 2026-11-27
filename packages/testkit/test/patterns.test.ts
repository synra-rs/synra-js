import { describe, expect, it } from 'vitest'
import { matches } from '../src/index'

describe('pattern matching', () => {
  it('matches an exact name', () => {
    expect(matches('_synra.device.changed', '_synra.device.changed')).toBe(true)
    expect(matches('_synra.device.changed', '_synra.device.offline')).toBe(false)
  })

  it('matches a star against exactly one segment', () => {
    expect(matches('_synra.*', '_synra.offline')).toBe(true)
    expect(matches('_synra.*', '_synra.device.changed')).toBe(false)
  })

  it('matches a run of stars against that many segments', () => {
    expect(matches('_synra.*.*', '_synra.device.changed')).toBe(true)
    expect(matches('_synra.*.*', '_synra.a.b.c')).toBe(false)
  })

  it('matches a pattern that is all stars at the right depth', () => {
    expect(matches('*.*', 'a.b')).toBe(true)
    expect(matches('*.*', 'a.b.c')).toBe(false)
  })
})
