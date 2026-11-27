import { describe, expect, it, vi } from 'vitest'
import { createMockClient, MockSynraClient } from '../src/index'

describe('policy before replacement responses', () => {
  it('refuses an unavailable subscription without installing its handler', () => {
    const client = createMockClient({ hostFeatures: [] })
    const handler = vi.fn()
    expect(() => client.event.subscribe('wanted.event', handler)).toThrow()
    client.deliver('wanted.event', {})
    expect(handler).not.toHaveBeenCalled()
    expect(client.calls).toMatchObject([{ ns: 'event', method: 'subscribe', args: ['wanted.event'], refused: { code: 'unsupported' } }])
  })

  it('checks clipboard grants before platform support', async () => {
    const client = createMockClient({ platformCapabilities: [] })
    await expect(client.clipboard.read()).rejects.toMatchObject({ code: 'capability_denied' })
  })

  it('uses the production clipboard permission names', async () => {
    const client = createMockClient({
      capabilities: ['platform:read-clipboard', 'platform:write-clipboard'],
      platformCapabilities: ['clipboard_read', 'clipboard_write'],
    })
    await expect(client.clipboard.read()).resolves.toBe('')
    await expect(client.clipboard.write('hello')).resolves.toBeUndefined()
  })

  it('does not record stub setup and records every real invocation and argument', async () => {
    const client = createMockClient({ capabilities: ['storage:local:read'] })
    client.stub('storage', 'get', 'fixture')
    expect(client.calls).toEqual([])
    await expect(client.storage.get('first')).resolves.toBe('fixture')
    await expect(client.storage.get('second', { fallback: 'default' })).resolves.toBe('fixture')
    expect(client.callCount('storage', 'get')).toBe(2)
    expect(client.lastArgs('storage', 'get')).toEqual(['second', { fallback: 'default' }])
  })

  it('does not let a response stub bypass permission refusal', async () => {
    const client = createMockClient()
    client.stub('device', 'list', [])
    await expect(client.device.list()).rejects.toMatchObject({ code: 'capability_denied' })
    expect(client.calls).toMatchObject([{ args: [], refused: { code: 'capability_denied' } }])
  })

  it('does not let a response stub bypass feature refusal', async () => {
    const client = createMockClient({ hostFeatures: [] })
    client.stub('device', 'pick', 'chosen')
    await expect(client.device.pick()).rejects.toMatchObject({ code: 'unsupported' })
  })

  it('records failures returned by an asynchronous stub', async () => {
    const client = createMockClient({ capabilities: ['device:list'] })
    const failure = { code: 'device_offline', message: 'offline', retryable: true }
    client.stub('device', 'list', Promise.reject(failure))
    await expect(client.device.list()).rejects.toMatchObject(failure)
    expect(client.calls).toEqual([{ ns: 'device', method: 'list', args: [], refused: failure }])
  })

  it('constructs the same support snapshot through either public entry', () => {
    const options = { hostFeatures: ['device.onChange'] as const }
    const direct = new MockSynraClient(options)
    const factory = createMockClient(options)
    expect(direct.device.supported).toEqual(factory.device.supported)
    expect(direct.device.supported).toEqual(['device.onChange'])
  })

  it('retains offline devices in the initial list and subsequent snapshots', async () => {
    const offline = { deviceId: 'offline', displayName: 'Laptop', platform: 'linux' as const, online: false }
    const client = createMockClient({ capabilities: ['device:list'], devices: [offline], hostFeatures: ['device.onChange'] })
    const handler = vi.fn()
    client.device.onChange(handler)
    await expect(client.device.list()).resolves.toEqual([offline])
    client.setDevices([offline])
    expect(handler).toHaveBeenCalledWith([offline])
  })
})
