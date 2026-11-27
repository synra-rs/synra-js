import type { EventNamespace, SubscriptionOptions, Unsubscribe } from '@synra/client'
import type { PluginDevicesChanged } from '@synra/protocol'
import type { MockExecution } from './execution.js'
import { asSynraError, createSynraError } from './errors/index.js'
import { compileEventPattern } from './event-pattern.js'

interface Subscription {
  readonly matches: (name: string) => boolean
  readonly handler: (payload: unknown) => void
  readonly options: SubscriptionOptions | undefined
}

export class MockEvents {
  private readonly subscribers = new Set<Subscription>()
  readonly namespace: EventNamespace

  constructor(execution: MockExecution) {
    this.namespace = {
      emit: async (name, payload) => execution.run('event', 'emit', [name, payload], () => undefined),
      subscribe: <T = unknown>(pattern: string, handler: (payload: T) => void, options?: SubscriptionOptions): Unsubscribe => {
        const match = compileEventPattern(pattern)
        return execution.sync('event', 'subscribe', [pattern], () => {
          return this.register(name => match?.(name) ?? false, payload => handler(payload as T), options)
        }, {
          feature: 'event.subscribe',
          validate: () => {
            if (match === undefined)
              throw createSynraError('invalid_argument', { field: 'pattern' })
            if (match('device.changed'))
              execution.require('device:list')
          },
        })
      },
    }
  }

  onDevices(handler: (payload: PluginDevicesChanged) => void, options?: SubscriptionOptions): Unsubscribe {
    return this.register(name => name === 'device.changed', payload => handler(payload as PluginDevicesChanged), options)
  }

  private register(matches: Subscription['matches'], handler: Subscription['handler'], options?: SubscriptionOptions): Unsubscribe {
    const subscription = { matches, handler, options }
    this.subscribers.add(subscription)
    return () => {
      this.subscribers.delete(subscription)
    }
  }

  deliver(name: string, payload: unknown): number {
    let delivered = 0
    for (const subscription of [...this.subscribers]) {
      if (!this.subscribers.has(subscription) || !subscription.matches(name))
        continue
      try {
        subscription.handler(payload)
      }
      catch (error) {
        const report = subscription.options?.onError
        const failure = asSynraError(error)
        if (report === undefined) {
          console.error('Synra event subscription', failure)
        }
        else {
          try {
            report(failure)
          }
          catch (cause) {
            console.error('Synra event error handler', asSynraError(cause))
          }
        }
      }
      delivered++
    }
    return delivered
  }
}
