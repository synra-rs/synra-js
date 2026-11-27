import { describe, expect, it } from 'vitest'
import { createMockClient } from '../src/index'
import { devices, expectCode } from './fixtures'

describe('progressive enhancement', () => {
  it('refuses an unimplemented feature with unsupported rather than throwing a TypeError', async () => {
    // The reason the methods must exist even when unimplemented: `TypeError: not a function` is not
    // a diagnosable error, and an author has no way to handle it.
    const synra = createMockClient({ hostFeatures: [] })
    await expectCode(synra.device.pick(), 'unsupported')
  })

  it('reports which features the host implements', () => {
    const synra = createMockClient({ hostFeatures: ['device.pick'] })
    expect(synra.device.supported).toEqual(['device.pick'])
    expect(synra.env.hostSupports('device.pick')).toBe(true)
    expect(synra.env.hostSupports('device.onChange')).toBe(false)
  })

  it('lets an author write the degraded path and exercise it', async () => {
    // The pattern the design document recommends: check the snapshot, then fall back.
    const synra = createMockClient({
      capabilities: ['device:list'],
      devices,
      hostFeatures: [],
    })
    const listed = await synra.device.list()
    const canPick = synra.device.supported.includes('device.pick')
    const chosen = canPick ? await synra.device.pick() : (listed[0]?.deviceId ?? null)
    expect(chosen).toBe('dev_a')
  })

  it('throws from a subscription to an unimplemented feature', () => {
    // A subscription cannot return a rejected promise usefully, so the refusal is synchronous.
    const synra = createMockClient({ hostFeatures: [] })
    expect(() => synra.device.onChange(() => undefined)).toThrow()
  })

  it('returns the explicitly provided user selection', async () => {
    const synra = createMockClient({
      capabilities: [],
      devices,
      hostFeatures: ['device.pick'],
      pickedDevice: 'dev_a',
    })
    await expect(synra.device.pick({ title: 'Where?' })).resolves.toBe('dev_a')
  })
})
