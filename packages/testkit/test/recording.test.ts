import { describe, expect, it } from 'vitest'
import { createMockClient } from '../src/index'

describe('call recording', () => {
  it('records the arguments a call was made with', async () => {
    // The shape the design document shows: `expect(synra.calls).toContainEqual({ ns, method, args })`.
    const synra = createMockClient({ capabilities: ['device:send:*'] })
    const args = { to: 'dev_a', event: 'chat.text', payload: { body: 'hi' } }
    await synra.device.send(args)
    expect(synra.calls).toContainEqual({ ns: 'device', method: 'send', args: [args] })
  })

  it('counts calls', async () => {
    const synra = createMockClient({ capabilities: ['storage:local:write'] })
    await synra.storage.set('a', 1)
    await synra.storage.set('b', 2)
    expect(synra.callCount('storage', 'set')).toBe(2)
    expect(synra.called('storage', 'set')).toBe(true)
    expect(synra.called('storage', 'delete')).toBe(false)
  })

  it('returns the last arguments for a method', async () => {
    const synra = createMockClient({ capabilities: ['storage:local:write'] })
    await synra.storage.set('a', 1)
    await synra.storage.set('b', 2)
    expect(synra.lastArgs('storage', 'set')).toEqual(['b', 2])
  })

  it('clears the recording without clearing state', async () => {
    const synra = createMockClient({ capabilities: ['storage:local:read', 'storage:local:write'] })
    await synra.storage.set('k', 'v')
    synra.clearCalls()
    expect(synra.calls).toHaveLength(0)
    await expect(synra.storage.get('k')).resolves.toBe('v')
  })

  it('describes the calls for a failure message', async () => {
    const synra = createMockClient({ capabilities: [] })
    await synra.device.list().catch(() => undefined)
    const description = synra.describeCalls()
    expect(description).toContain('device.list')
    expect(description).toContain('capability_denied')
  })
})
