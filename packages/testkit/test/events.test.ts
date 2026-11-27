import { describe, expect, it, vi } from 'vitest'
import { createMockClient } from '../src/index'

describe('events', () => {
  it('rejects malformed patterns before registering callbacks', () => {
    const client = createMockClient()
    const listener = vi.fn()
    expect(() => client.event.subscribe('device.**', listener)).toThrow()
    expect(client.calls[0]?.refused?.code).toBe('invalid_argument')
    client.deliver('device.changed', {})
    expect(listener).not.toHaveBeenCalled()
  })

  it('gives each subscription an independent cleanup even for the same callback', () => {
    const client = createMockClient()
    const listener = vi.fn()
    const first = client.event.subscribe('device.*', listener)
    const second = client.event.subscribe('device.*', listener)
    expect(client.deliver('device.changed', {})).toBe(2)
    first()
    first()
    expect(client.deliver('device.changed', {})).toBe(1)
    second()
    expect(client.deliver('device.changed', {})).toBe(0)
  })
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
    const synra = createMockClient({ capabilities: ['event:emit:_plugin.@acme/chat.*'] })
    await synra.event.emit('_plugin.@acme/chat.text', { body: 'hi' })
    expect(synra.lastArgs('event', 'emit')).toEqual(['_plugin.@acme/chat.text', { body: 'hi' }])
  })
})
