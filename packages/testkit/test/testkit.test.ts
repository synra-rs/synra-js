/**
 * `@synra/testkit` 的行为断言。
 *
 * 这些测试的立场是**插件作者**的：他们要能相信 mock 的拒绝就是真机会给的拒绝。所以断言的重点
 * 不是"mock 能返回一个值"，而是"mock 拒绝的东西与内核拒绝的东西一致"。
 */

import type { SynraError, TransferProgress } from '@synra/client'
import { describe, expect, it, vi } from 'vitest'

import { createMockClient, matches, MockSynraClient, synraError } from '../src/index'

/** 断言一个 promise 以一个特定错误码拒绝。 */
async function expectCode(
  operation: Promise<unknown>,
  code: string,
): Promise<SynraError> {
  try {
    await operation
  }
  catch (error) {
    const typed = error as SynraError
    expect(typed.code).toBe(code)
    return typed
  }
  throw new Error(`expected a rejection with code ${code}, but the call resolved`)
}

const devices = [
  { deviceId: 'dev_a', displayName: 'My PC', platform: 'linux' as const, online: true },
  { deviceId: 'dev_b', displayName: 'Laptop', platform: 'macos' as const, online: false },
]

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
    await expect(synra.device.list()).resolves.toEqual([devices[0]])
  })

  it('lists only the devices that are online', async () => {
    // A plugin that sends to an offline device should be able to find that out before trying.
    const synra = createMockClient({ capabilities: ['device:list'], devices })
    const listed = await synra.device.list()
    expect(listed.map(device => device.deviceId)).toEqual(['dev_a'])
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

  it('treats a bare star as granting everything, for a test that does not care about permissions', async () => {
    // `*` is a testkit shorthand and **not** a capability the DSL accepts. It exists so a test about
    // something else does not have to enumerate the grants it needs. A test that is about permissions
    // must not use it, because `*` cannot be granted to a real plugin — which is exactly what makes it
    // safe as a shorthand and dangerous as a habit.
    const synra = createMockClient({ capabilities: ['*'] })
    await expect(synra.device.broadcast({ event: 'x' })).resolves.toBeUndefined()
    await expect(synra.storage.get('missing')).resolves.toBeUndefined()
    expect(synra.env.can('device:list')).toBe(true)
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

describe('platform gating checks two different questions', () => {
  it('refuses when the platform does not support the action', async () => {
    // Simulating iOS: the plugin may hold the capability and the platform still cannot.
    const synra = createMockClient({
      capabilities: ['platform:open-url'],
      platformCapabilities: [],
    })
    const error = await expectCode(synra.platform.openUrl('https://example.com'), 'unsupported')
    expect(error.message).toContain('open_url')
  })

  it('refuses when the plugin does not hold the capability', async () => {
    // The other direction: the platform can, and the plugin was not granted it.
    const synra = createMockClient({
      capabilities: [],
      platformCapabilities: ['open_url'],
    })
    await expectCode(synra.platform.openUrl('https://example.com'), 'capability_denied')
  })

  it('allows when both hold', async () => {
    const synra = createMockClient({
      capabilities: ['platform:open-url'],
      platformCapabilities: ['open_url'],
    })
    await expect(synra.platform.openUrl('https://example.com')).resolves.toBeUndefined()
  })

  it('answers the two checks separately through env', () => {
    // `env.can` and `env.platformSupports` must not be the same question, because the interface says
    // different things for each.
    const synra = createMockClient({
      capabilities: ['platform:simulate-keys'],
      platformCapabilities: [],
    })
    expect(synra.env.can('platform:simulate-keys')).toBe(true)
    expect(synra.env.platformSupports('simulate_keys')).toBe(false)
  })

  it('reports an empty clipboard rather than inventing content', async () => {
    // A mock that returned plausible-looking text would make a test pass that the real host fails.
    const synra = createMockClient({
      capabilities: ['platform:clipboard:read'],
      platformCapabilities: ['clipboard_read'],
    })
    await expect(synra.clipboard.read()).resolves.toBe('')
  })
})

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

  it('picks the first online device by default', async () => {
    const synra = createMockClient({
      capabilities: [],
      devices,
      hostFeatures: ['device.pick'],
    })
    await expect(synra.device.pick({ title: 'Where?' })).resolves.toBe('dev_a')
  })
})

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

describe('storage', () => {
  it('round-trips a value', async () => {
    const synra = createMockClient({ capabilities: ['storage:local:read', 'storage:local:write'] })
    await synra.storage.set('chat:last', { id: 'm1' })
    await expect(synra.storage.get('chat:last')).resolves.toEqual({ id: 'm1' })
  })

  it('returns undefined for a missing key with no fallback', async () => {
    const synra = createMockClient({ capabilities: ['storage:local:read'] })
    await expect(synra.storage.get('missing')).resolves.toBeUndefined()
  })

  it('returns the fallback for a missing key', async () => {
    // The overload exists so a caller with a fallback does not have to handle `undefined`.
    const synra = createMockClient({ capabilities: ['storage:local:read'] })
    await expect(synra.storage.get('missing', { fallback: 42 })).resolves.toBe(42)
  })

  it('returns the stored value and not the fallback', async () => {
    const synra = createMockClient({ capabilities: ['storage:local:read', 'storage:local:write'] })
    await synra.storage.set('present', 'stored')
    await expect(synra.storage.get('present', { fallback: 'default' })).resolves.toBe('stored')
  })

  it('deletes a value', async () => {
    const synra = createMockClient({ capabilities: ['storage:local:read', 'storage:local:write'] })
    await synra.storage.set('k', 1)
    await synra.storage.delete('k')
    await expect(synra.storage.get('k')).resolves.toBeUndefined()
  })

  it('lists keys and filters by prefix', async () => {
    const synra = createMockClient({ capabilities: ['storage:local:read', 'storage:local:write'] })
    await synra.storage.set('chat:a', 1)
    await synra.storage.set('chat:b', 2)
    await synra.storage.set('other', 3)
    await expect(synra.storage.keys()).resolves.toHaveLength(3)
    await expect(synra.storage.keys('chat:')).resolves.toEqual(['chat:a', 'chat:b'])
  })

  it('reports a quota with a plausible shape', async () => {
    const synra = createMockClient({ capabilities: ['storage:local:write'] })
    await synra.storage.set('k', 'v')
    const quota = await synra.storage.quota()
    expect(quota.usedBytes).toBeGreaterThan(0)
    expect(quota.maxBytes).toBeGreaterThan(quota.usedBytes)
  })
})

describe('events', () => {
  it('delivers a payload to a subscriber', () => {
    const synra = createMockClient()
    const handler = vi.fn()
    synra.event.subscribe('_synra.device.changed', handler)
    synra.deliver('_synra.device.changed', { deviceId: 'dev_a' })
    expect(handler).toHaveBeenCalledWith({ deviceId: 'dev_a' })
  })

  it('returns an unsubscribe that stops delivery', () => {
    // The reason the signature always returns one: a plugin page that unloads without it leaks.
    const synra = createMockClient()
    const handler = vi.fn()
    const unsubscribe = synra.event.subscribe('_synra.device.changed', handler)
    unsubscribe()
    synra.deliver('_synra.device.changed', {})
    expect(handler).not.toHaveBeenCalled()
  })

  it('does not deliver an event of a different depth to a one-segment wildcard', () => {
    // The kernel's handle semantics, which the mock shares so a passing test means a working plugin:
    // `_synra.*` matches `_synra.offline` and not `_synra.device.changed`.
    const synra = createMockClient()
    const handler = vi.fn()
    synra.event.subscribe('_synra.*', handler)
    synra.deliver('_synra.offline', {})
    synra.deliver('_synra.device.changed', {})
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('delivers to every subscriber of a matching pattern', () => {
    const synra = createMockClient()
    const first = vi.fn()
    const second = vi.fn()
    synra.event.subscribe('_synra.device.changed', first)
    synra.event.subscribe('_synra.*.*', second)
    const delivered = synra.deliver('_synra.device.changed', {})
    expect(delivered).toBe(2)
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('records an emit', async () => {
    const synra = createMockClient({ capabilities: ['event:emit:_plugin.chat.*'] })
    await synra.event.emit('_plugin.chat.text', { body: 'hi' })
    expect(synra.lastArgs('event', 'emit')).toEqual(['_plugin.chat.text', { body: 'hi' }])
  })
})

describe('device changes and transfer progress', () => {
  it('notifies device watchers when the set changes', () => {
    const synra = createMockClient({ hostFeatures: ['device.onChange'], devices })
    const handler = vi.fn()
    const unsubscribe = synra.device.onChange(handler)
    synra.setDevices([devices[0]!])
    expect(handler).toHaveBeenCalledWith([devices[0]])
    unsubscribe()
    synra.setDevices([])
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('notifies progress watchers for one transfer only', () => {
    const synra = createMockClient({ hostFeatures: ['transfer.onProgress'] })
    const handler = vi.fn()
    synra.transfer.onProgress('t1', handler)
    const progress: TransferProgress = {
      transferId: 't2',
      state: 'transferring',
      receivedBytes: 1,
      totalBytes: 2,
      ratio: 0.5,
    }
    // A different transfer's progress must not reach this handler, or a UI showing two transfers
    // would update the wrong bar.
    synra.reportProgress(progress)
    expect(handler).not.toHaveBeenCalled()

    synra.reportProgress({ ...progress, transferId: 't1' })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('returns a transfer id from a send', async () => {
    const synra = createMockClient({ capabilities: ['file:transfer:send'] })
    const id = await synra.transfer.send({
      to: 'dev_a',
      file: new Blob(['x']),
      fileName: 'x.txt',
    })
    expect(id).toMatch(/^mock-transfer-/)
  })

  it('refuses a transfer without the capability', async () => {
    const synra = createMockClient({ capabilities: [] })
    await expectCode(
      synra.transfer.send({ to: 'dev_a', file: new Blob(['x']), fileName: 'x.txt' }),
      'capability_denied',
    )
  })
})

describe('network', () => {
  it('refuses a fetch when the host does not implement it', async () => {
    const synra = createMockClient({ hostFeatures: [] })
    await expectCode(synra.network.fetch('https://example.com'), 'unsupported')
  })

  it('refuses a fetch without the host capability', async () => {
    const synra = createMockClient({
      capabilities: [],
      hostFeatures: ['network.fetch'],
    })
    const error = await expectCode(synra.network.fetch('https://api.example.com/x'), 'capability_denied')
    // The capability names the host, which is how a manifest declares one `network:fetch:<host>` per
    // destination rather than a blanket grant.
    expect(error.message).toContain('api.example.com')
  })

  it('allows a fetch with the host capability', async () => {
    const synra = createMockClient({
      capabilities: ['network:fetch:api.example.com'],
      hostFeatures: ['network.fetch'],
    })
    const response = await synra.network.fetch('https://api.example.com/x')
    expect(response.ok).toBe(true)
    expect(response.status).toBe(200)
  })

  it('returns an empty body rather than inventing content', async () => {
    // A mock that returned plausible JSON would make a test pass that the real host fails.
    const synra = createMockClient({
      capabilities: ['network:fetch:api.example.com'],
      hostFeatures: ['network.fetch'],
    })
    const response = await synra.network.fetch('https://api.example.com/x')
    await expect(response.text()).resolves.toBe('')
  })

  it('refuses a second read of the same body', async () => {
    // The three readers are mutually exclusive, as they are on a real response. A test that reads
    // twice would pass against a mock that allowed it and fail against the host.
    const synra = createMockClient({
      capabilities: ['network:fetch:api.example.com'],
      hostFeatures: ['network.fetch'],
    })
    const response = await synra.network.fetch('https://api.example.com/x')
    await response.text()
    await expectCode(response.json(), 'internal')
  })

  it('extracts a host from a URL for the capability check', async () => {
    const synra = createMockClient({ capabilities: [], hostFeatures: ['network.fetch'] })
    const error = await expectCode(synra.network.fetch('https://a.b.c:8443/p?q=1'), 'capability_denied')
    expect(error.message).toContain('a.b.c:8443')
  })
})

describe('stubbing', () => {
  it('lets a call return a value', async () => {
    const synra = createMockClient({ capabilities: ['device:list'] })
    synra.stub('device', 'list', [{ deviceId: 'x', displayName: 'X', platform: 'linux', online: true }])
    await expect(synra.device.list()).resolves.toHaveLength(1)
  })

  it('lets a call fail with a chosen error', async () => {
    // The shape the design document shows: a failure that never happened needs to be testable.
    const synra = createMockClient({ capabilities: ['platform:open-url'], platformCapabilities: ['open_url'] })
    const error = synraError('capability_denied', 'denied')
    synra.stub('platform', 'openUrl', error)
    await expect(synra.platform.openUrl('https://example.com')).resolves.toBe(error)
  })

  it('records that a stub was used, so an assertion can see it', () => {
    const synra = createMockClient()
    synra.stub('self', 'invoke', { messageId: 'm1' })
    expect(synra.called('self', 'invoke')).toBe(true)
  })
})

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

describe('logging', () => {
  it('records every level', () => {
    const synra = createMockClient()
    synra.log.trace('t')
    synra.log.debug('d')
    synra.log.info('i')
    synra.log.warn('w')
    synra.log.error('e')
    expect(synra.calls.filter(call => call.ns === 'log')).toHaveLength(5)
  })

  it('prefixes a child logger onto the message', () => {
    const synra = createMockClient()
    const child = synra.log.child('chat')
    child.info('sent')
    expect(synra.lastArgs('log', 'info')).toEqual(['chat sent', undefined])
  })

  it('nests child prefixes', () => {
    const synra = createMockClient()
    synra.log.child('chat').child('outbox').info('sent')
    expect(synra.lastArgs('log', 'info')?.[0]).toBe('chat outbox sent')
  })
})

describe('the error constructor', () => {
  it('carries what the type requires', () => {
    const error = synraError('timeout', 'too slow', { retryable: true, traceId: 't1' })
    expect(error).toEqual({ code: 'timeout', message: 'too slow', retryable: true, traceId: 't1' })
  })

  it('defaults to not retryable', () => {
    // The safe default: telling a caller to retry something that cannot succeed makes it retry forever.
    expect(synraError('invalid_argument', 'bad').retryable).toBe(false)
  })

  it('omits absent optional fields rather than writing undefined', () => {
    // `exactOptionalPropertyTypes` makes the distinction visible, and the wire format would reject an
    // explicit `null` where a field is absent.
    const error = synraError('internal', 'x')
    expect('traceId' in error).toBe(false)
    expect('actions' in error).toBe(false)
  })

  it('is recognised by the mock own predicate', () => {
    const synra = new MockSynraClient()
    expect(synra.isSynraError(synraError('internal', 'x'))).toBe(true)
    expect(synra.isSynraError(new Error('plain'))).toBe(false)
    expect(synra.isSynraError(null)).toBe(false)
    expect(synra.isCode(synraError('timeout', 'x'), 'timeout')).toBe(true)
  })
})

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

describe('an author can run a plugin without a host', () => {
  it('through a full interaction', async () => {
    // The end-to-end shape: the mock is configured like a host, the plugin's code runs against it, and
    // the calls are asserted. No host, no IPC, no Tauri.
    const synra = createMockClient({
      capabilities: ['device:list', 'device:send:*', 'storage:local:read', 'storage:local:write'],
      devices,
      platformCapabilities: ['open_url'],
      hostFeatures: ['device.onChange'],
    })

    const online = await synra.device.list()
    const target = online[0]!
    await synra.device.send({ to: target.deviceId, event: 'chat.text', payload: { body: 'hi' } })
    await synra.storage.set('last-target', target.deviceId)
    synra.log.info('sent')

    expect(synra.callCount('device', 'send')).toBe(1)
    expect(synra.lastArgs('storage', 'set')).toEqual(['last-target', 'dev_a'])
    expect(synra.calls.map(call => `${call.ns}.${call.method}`)).toEqual([
      'device.list',
      'device.send',
      'storage.set',
      'log.info',
    ])
  })
})
