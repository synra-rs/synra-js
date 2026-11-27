import { describe, expect, it } from 'vitest'
import { createMockClient } from '../src/index'
import { expectCode } from './fixtures'

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
      capabilities: ['platform:read-clipboard'],
      platformCapabilities: ['clipboard_read'],
    })
    await expect(synra.clipboard.read()).resolves.toBe('')
  })
})
