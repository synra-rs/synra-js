import { describe, expect, it } from 'vitest'
import { createMockClient, synraError } from '../src/index'

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
    synra.stubFailure('platform', 'openUrl', error)
    await expect(synra.platform.openUrl('https://example.com')).rejects.toEqual(error)
  })

  it('records the invocation that uses a stub', async () => {
    const synra = createMockClient()
    synra.stub('self', 'invoke', { messageId: 'm1' })
    expect(synra.called('self', 'invoke')).toBe(false)
    await synra.self.invoke('send')
    expect(synra.called('self', 'invoke')).toBe(true)
  })
})
