import { describe, expect, it } from 'vitest'
import { createMockClient } from '../src/index'
import { devices } from './fixtures'

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
