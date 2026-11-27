import type { EventNamespace, Unsubscribe } from '@synra/client'
import type { MockExecution } from './execution.js'

/** One-segment event wildcard; capability wildcards use a different grammar. */
export function matches(pattern: string, name: string): boolean {
  const patternParts = pattern.split('.')
  const nameParts = name.split('.')
  return patternParts.length === nameParts.length
    && patternParts.every((part, index) => part === '*' || part === nameParts[index])
}

export class MockEvents {
  private readonly subscribers = new Map<string, Set<(payload: unknown) => void>>()
  readonly namespace: EventNamespace

  constructor(execution: MockExecution) {
    this.namespace = {
      emit: async (name, payload) => execution.run('event', 'emit', [name, payload], () => undefined),
      subscribe: <T = unknown>(pattern: string, handler: (payload: T) => void): Unsubscribe =>
        execution.sync('event', 'subscribe', [pattern], () => {
          const handlers = this.subscribers.get(pattern) ?? new Set()
          const wrapped = handler as (payload: unknown) => void
          handlers.add(wrapped)
          this.subscribers.set(pattern, handlers)
          return () => {
            handlers.delete(wrapped)
            if (handlers.size === 0)
              this.subscribers.delete(pattern)
          }
        }, { feature: 'event.subscribe' }),
    }
  }

  deliver(name: string, payload: unknown): number {
    let delivered = 0
    for (const [pattern, handlers] of this.subscribers) {
      if (!matches(pattern, name))
        continue
      for (const handler of [...handlers]) {
        handler(payload)
        delivered++
      }
    }
    return delivered
  }
}
