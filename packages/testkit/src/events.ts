import type { EventNamespace, Unsubscribe } from '@synra/client'
import type { MockExecution } from './execution.js'
import { createSynraError } from './errors/index.js'
import { compileEventPattern } from './event-pattern.js'

interface Subscription {
  readonly matches: (name: string) => boolean
  readonly handler: (payload: unknown) => void
}

export class MockEvents {
  private readonly subscribers = new Set<Subscription>()
  readonly namespace: EventNamespace

  constructor(execution: MockExecution) {
    this.namespace = {
      emit: async (name, payload) => execution.run('event', 'emit', [name, payload], () => undefined),
      subscribe: <T = unknown>(pattern: string, handler: (payload: T) => void): Unsubscribe => {
        const match = compileEventPattern(pattern)
        return execution.sync('event', 'subscribe', [pattern], () => {
          const subscription: Subscription = {
            matches: name => match?.(name) ?? false,
            handler: payload => handler(payload as T),
          }
          this.subscribers.add(subscription)
          return () => {
            this.subscribers.delete(subscription)
          }
        }, {
          feature: 'event.subscribe',
          validate: () => {
            if (match === undefined)
              throw createSynraError('invalid_argument', { field: 'pattern' })
          },
        })
      },
    }
  }

  deliver(name: string, payload: unknown): number {
    let delivered = 0
    for (const subscription of [...this.subscribers]) {
      if (!this.subscribers.has(subscription) || !subscription.matches(name))
        continue
      subscription.handler(payload)
      delivered++
    }
    return delivered
  }
}
