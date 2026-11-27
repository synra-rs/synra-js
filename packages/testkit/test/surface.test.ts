import { describe, expect, it } from 'vitest'
import { createMockClient } from '../src/index'

describe('the mock is a SynraClient', () => {
  it('has every namespace a plugin uses', () => {
    const synra = createMockClient()
    for (const namespace of [
      'env',
      'log',
      'event',
      'device',
      'storage',
      'network',
      'transfer',
      'platform',
      'clipboard',
      'self',
    ] as const) {
      expect(synra[namespace], namespace).toBeDefined()
    }
  })

  it('has the judgement functions, because the type requires them', () => {
    // The type declares them, so a mock missing one would not compile — which is the point of the
    // mock implementing the interface rather than resembling it.
    const synra = createMockClient()
    expect(typeof synra.isSynraError).toBe('function')
    expect(typeof synra.isCode).toBe('function')
    expect(typeof synra.requestId).toBe('function')
  })
})
