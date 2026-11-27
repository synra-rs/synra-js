import { describe, expect, it } from 'vitest'
import { createMockClient } from '../src/index'
import { devices, expectCode } from './fixtures'

describe('capability gating', () => {
  it('refuses a call the plugin has not been granted', async () => {
    // The scenario worth testing first: granted nothing at all.
    const synra = createMockClient({ capabilities: [] })
    const error = await expectCode(synra.device.list(), 'capability_denied')
    expect(error.message).toContain('device:list')
    // And the error tells the user what to do about it.
    expect(error.actions?.[0]).toEqual({ kind: 'requestCapability', capability: 'device:list' })
  })

  it('allows a call the plugin has been granted', async () => {
    const synra = createMockClient({ capabilities: ['device:list'], devices })
    await expect(synra.device.list()).resolves.toEqual(devices)
  })

  it('retains offline devices with an explicit online flag', async () => {
    const synra = createMockClient({ capabilities: ['device:list'], devices })
    const listed = await synra.device.list()
    expect(listed.map(device => device.deviceId)).toEqual(['dev_a', 'dev_b'])
  })

  it('covers a qualified capability with a wildcard grant', async () => {
    // `device:send:*` covers `device:send:dev_a`, which is how a plugin that sends to any device
    // declares itself.
    const synra = createMockClient({ capabilities: ['device:send:*'] })
    await expect(
      synra.device.send({ to: 'dev_a', event: 'chat.text', payload: { body: 'hi' } }),
    ).resolves.toBeUndefined()
  })

  it('does not cover a different capability with a wildcard grant', async () => {
    // The mistake a wildcard makes possible: granting one domain's family must not grant another's.
    const synra = createMockClient({ capabilities: ['device:send:*'] })
    await expectCode(synra.device.broadcast({ event: 'x' }), 'capability_denied')
  })

  it('rejects a universal wildcard that the core DSL does not accept', () => {
    expect(() => createMockClient({ capabilities: ['*'] })).toThrow('invalid capability')
  })

  it('refuses a storage read without the read capability', async () => {
    const synra = createMockClient({ capabilities: ['storage:local:write'] })
    await expectCode(synra.storage.get('k'), 'capability_denied')
    await expect(synra.storage.set('k', 1)).resolves.toBeUndefined()
  })

  it('records the refusal as well as throwing it', async () => {
    // A test that asserts a call was refused should not have to catch the error first.
    const synra = createMockClient({ capabilities: [] })
    await synra.device.list().catch(() => undefined)
    const refused = synra.calls.find(call => call.ns === 'device' && call.method === 'list')
    expect(refused?.refused?.code).toBe('capability_denied')
  })
})
