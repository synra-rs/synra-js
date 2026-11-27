import type { StorageNamespace } from '@synra/client'
import type { MockExecution } from './execution.js'

export function createStorage(execution: MockExecution): StorageNamespace {
  const store = new Map<string, unknown>()
  function get<T = unknown>(key: string): Promise<T | undefined>
  function get<T>(key: string, defaults: { fallback: T }): Promise<T>
  async function get<T>(key: string, defaults?: { fallback: T }): Promise<T | undefined> {
    return execution.run('storage', 'get', defaults === undefined ? [key] : [key, defaults], () => store.has(key) ? store.get(key) as T : defaults?.fallback, { capability: 'storage:local:read' })
  }
  return {
    get,
    set: async (key, value) => execution.run('storage', 'set', [key, value], () => { store.set(key, value) }, { capability: 'storage:local:write' }),
    delete: async key => execution.run('storage', 'delete', [key], () => { store.delete(key) }, { capability: 'storage:local:write' }),
    keys: async prefix => execution.run('storage', 'keys', [prefix], () => [...store.keys()].filter(key => prefix === undefined || key.startsWith(prefix)), { capability: 'storage:local:read' }),
    quota: async () => execution.run('storage', 'quota', [], () => ({ usedBytes: JSON.stringify([...store]).length, maxBytes: 8 * 1024 * 1024 }), { capability: 'storage:local:read' }),
  }
}
