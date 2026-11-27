import type { EventNamespace, SubscriptionOptions, Unsubscribe } from '@synra/client'
import type { PluginDevicesChanged, PluginTransferStatus, TransferId } from '@synra/protocol'
import type { MockExecution } from './execution.js'
import { asSynraError, createSynraError } from './errors/index.js'
import { compileEventPattern, isCustomEventName } from './event-pattern.js'

interface Subscription {
  readonly matches: (name: string, payload: unknown) => boolean
  readonly handler: (payload: unknown) => void
  readonly options: SubscriptionOptions | undefined
}

const TOPIC_GRANTS = [
  ['device.changed', 'device:list'],
  ['transfer.progress', 'file:transfer:send'],
] as const

export class MockEvents {
  private readonly subscribers = new Set<Subscription>()
  readonly namespace: EventNamespace

  constructor(execution: MockExecution) {
    this.namespace = {
      emit: async (name, payload) => execution.run('event', 'emit', [name, payload], () => undefined),
      subscribe: <T = unknown>(pattern: string, handler: (payload: T) => void, options?: SubscriptionOptions): Unsubscribe => {
        const match = compileEventPattern(pattern)
        return execution.sync('event', 'subscribe', [pattern], () => {
          return this.register((name) => {
            const grant = isCustomEventName(name) ? `event:subscribe:${name}` : TOPIC_GRANTS.find(([topic]) => topic === name)?.[1]
            return (match?.(name) ?? false) && (grant === undefined || execution.capabilities.can(grant))
          }, payload => handler(payload as T), options)
        }, {
          feature: 'event.subscribe',
          validate: () => {
            if (match === undefined)
              throw createSynraError('invalid_argument', { field: 'pattern' })
            if (isCustomEventName(pattern))
              execution.require(`event:subscribe:${pattern}`)
            const matched = TOPIC_GRANTS.filter(([topic]) => match(topic))
            const first = matched[0]
            if (first !== undefined && !matched.some(([, grant]) => execution.capabilities.can(grant)))
              execution.require(first[1])
          },
        })
      },
    }
  }

  onDevices(handler: (payload: PluginDevicesChanged) => void, options?: SubscriptionOptions): Unsubscribe {
    return this.register(name => name === 'device.changed', payload => handler(payload as PluginDevicesChanged), options)
  }

  onTransfer(id: TransferId, handler: (payload: PluginTransferStatus) => void, options?: SubscriptionOptions): Unsubscribe {
    const matches = (name: string, payload: unknown): boolean =>
      name === 'transfer.progress' && (payload as PluginTransferStatus | null)?.transferId === id
    return this.register(matches, payload => handler(payload as PluginTransferStatus), options)
  }

  private register(matches: Subscription['matches'], handler: Subscription['handler'], options?: SubscriptionOptions): Unsubscribe {
    const subscription = { matches, handler, options }
    this.subscribers.add(subscription)
    return () => {
      this.subscribers.delete(subscription)
    }
  }

  deliver(name: string, payload: unknown): number {
    if (name.startsWith('_plugin.') && (!isCustomEventName(name) || payload === null || typeof payload !== 'object' || Array.isArray(payload)))
      return 0
    let delivered = 0
    for (const subscription of [...this.subscribers]) {
      if (!this.subscribers.has(subscription) || !subscription.matches(name, payload))
        continue
      this.notify(subscription.handler, payload, subscription.options)
      delivered++
    }
    return delivered
  }

  notify<T>(handler: (payload: T) => void, payload: T, options?: SubscriptionOptions): void {
    try {
      handler(payload)
    }
    catch (error) {
      this.report(error, options)
    }
  }

  report(error: unknown, options?: SubscriptionOptions): void {
    const report = options?.onError
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
}
