import { describe, expect, it } from 'vitest'
import { createMockClient } from '../src/index'

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
    const synra = createMockClient({ capabilities: ['storage:local:read', 'storage:local:write'] })
    await synra.storage.set('k', 'v')
    const quota = await synra.storage.quota()
    expect(quota.usedBytes).toBeGreaterThan(0)
    expect(quota.maxBytes).toBeGreaterThan(quota.usedBytes)
  })
})
