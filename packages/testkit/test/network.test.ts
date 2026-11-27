import { describe, expect, it } from 'vitest'
import { createMockClient, createMockResponse } from '../src/index'
import { expectCode } from './fixtures'

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
    synra.stub('network', 'fetch', createMockResponse(''))
    const response = await synra.network.fetch('https://api.example.com/x')
    expect(response.ok).toBe(true)
    expect(response.status).toBe(200)
  })

  it('returns an explicitly empty response body', async () => {
    const synra = createMockClient({
      capabilities: ['network:fetch:api.example.com'],
      hostFeatures: ['network.fetch'],
    })
    synra.stub('network', 'fetch', createMockResponse(''))
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
    synra.stub('network', 'fetch', createMockResponse(''))
    const response = await synra.network.fetch('https://api.example.com/x')
    await response.text()
    await expectCode(response.json(), 'invalid_argument')
  })

  it('extracts a host from a URL for the capability check', async () => {
    const synra = createMockClient({ capabilities: [], hostFeatures: ['network.fetch'] })
    const error = await expectCode(synra.network.fetch('https://a.b.c:8443/p?q=1'), 'capability_denied')
    expect(error.actions).toContainEqual({ kind: 'requestCapability', capability: 'network:fetch:a.b.c:GET' })
  })

  it('requires a concrete host grant for the requested method', async () => {
    const synra = createMockClient({
      capabilities: ['network:fetch:api.example.com:GET', 'network:fetch:**'],
      hostFeatures: ['network.fetch'],
    })
    synra.stub('network', 'fetch', createMockResponse(''))
    await expectCode(synra.network.fetch('https://api.example.com/x', { method: 'POST' }), 'capability_denied')
  })

  it('checks the length of the URL sent to the transport', async () => {
    const synra = createMockClient({
      capabilities: ['network:fetch:api.example.com'],
      hostFeatures: ['network.fetch'],
    })
    synra.stub('network', 'fetch', createMockResponse(''))
    const input = `https://api.example.com/${'é'.repeat(400)}`
    await expectCode(synra.network.fetch(input), 'invalid_argument')
  })
})
