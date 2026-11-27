import { describe, expect, it } from 'vitest'
import { createMockClient } from '../src/index'
import { expectCode } from './fixtures'

describe('self', () => {
  it('fails a call to the headless side that has no stub', async () => {
    // Returning `undefined` would let the author's code treat it as a result and keep going, which is
    // the failure mode that costs the most time to diagnose.
    const synra = createMockClient()
    const error = await expectCode(synra.self.invoke('send-message', {}), 'internal')
    expect(error.message).toContain('stub')
  })

  it('lists the declared actions', async () => {
    const synra = createMockClient()
    synra.declareAction({ name: 'send-message', description: 'Send' })
    await expect(synra.self.actions()).resolves.toEqual([
      { name: 'send-message', description: 'Send' },
    ])
  })
})
