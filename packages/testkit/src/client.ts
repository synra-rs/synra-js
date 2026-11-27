import type { ActionDescriptor, DeviceTarget, SynraClient, SynraError, TransferProgress, TransferStatus } from '@synra/client'
import type { ErrorCode } from '@synra/protocol'
import type { RecordedCall } from './execution.js'
import type { MockOptions } from './options.js'
import { MockDevices } from './devices.js'
import { createEnvironment, createLog } from './environment.js'
import { synraError } from './error-constructor.js'
import { isSynraErrorValue } from './errors/index.js'
import { errorSnapshot } from './errors/shape.js'
import { MockEvents } from './events.js'
import { MockExecution } from './execution.js'
import { createNetwork } from './network.js'
import { createClipboard, createPlatform } from './platform.js'
import { SIMULATED_PROFILE, snapshotProfile } from './profile.js'
import { createStorage } from './storage.js'
import { MockTransfers } from './transfers.js'

/** Configurable protocol substitute. It models policy and observations without native side effects. */
export class MockSynraClient implements SynraClient {
  private readonly execution: MockExecution
  private readonly events: MockEvents
  private readonly devices: MockDevices
  private readonly transfers: MockTransfers
  private readonly actions: ActionDescriptor[] = []
  private nextId = 0
  private readyCalls = 0
  readonly env: SynraClient['env']
  readonly log: SynraClient['log']
  readonly event: SynraClient['event']
  readonly device: SynraClient['device']
  readonly storage: SynraClient['storage']
  readonly network: SynraClient['network']
  readonly transfer: SynraClient['transfer']
  readonly platform: SynraClient['platform']
  readonly clipboard: SynraClient['clipboard']
  readonly self: SynraClient['self']

  constructor(private readonly options: MockOptions = {}) {
    this.execution = new MockExecution(snapshotProfile(options.profile ?? SIMULATED_PROFILE, options.hostFeatures, options.platformCapabilities ?? []), options.capabilities ?? [])
    this.events = new MockEvents(this.execution)
    this.devices = new MockDevices(this.execution, options)
    this.transfers = new MockTransfers(this.execution, () => this.id('transfer'))
    this.env = createEnvironment(this.execution, options)
    this.log = createLog(this.execution)
    this.event = this.events.namespace
    this.device = this.devices.namespace
    this.storage = createStorage(this.execution)
    this.network = createNetwork(this.execution)
    this.transfer = this.transfers.namespace
    this.platform = createPlatform(this.execution)
    this.clipboard = createClipboard(this.execution)
    this.self = {
      invoke: async <Args = unknown, Result = unknown>(action: string, args?: Args): Promise<Result> =>
        this.execution.run('self', 'invoke', [action, args], () => {
          throw synraError('internal', 'self.invoke requires an explicit response stub')
        }),
      actions: async () => this.execution.run('self', 'actions', [], () => [...this.actions]),
    }
  }

  get calls(): RecordedCall[] { return this.execution.calls }
  called(ns: string, method: string): boolean { return this.calls.some(call => call.ns === ns && call.method === method) }
  callCount(ns: string, method: string): number { return this.calls.filter(call => call.ns === ns && call.method === method).length }
  lastArgs(ns: string, method: string): readonly unknown[] | undefined {
    for (let index = this.calls.length - 1; index >= 0; index--) {
      const call = this.calls[index]
      if (call?.ns === ns && call.method === method)
        return call.args
    }
    return undefined
  }

  clearCalls(): void { this.calls.length = 0 }
  describeCalls(): string {
    return this.calls.map(call => `${call.ns}.${call.method}(${String(call.args.length)} args)${call.refused ? ` -> ${call.refused.code}` : ''}`).join('\n')
  }

  /** Replace responses after policy checks. Setting a stub is not a business call. */
  stub(ns: string, method: string, value: unknown): void { this.execution.stub(ns, method, value) }
  /** Explicit rejection fixture; error-shaped success values remain ordinary values. */
  stubFailure(ns: string, method: string, reason: unknown): void { this.execution.stubFailure(ns, method, reason) }
  deliver(name: string, payload: unknown): number { return this.events.deliver(name, payload) }
  setDevices(devices: readonly DeviceTarget[]): void { this.devices.set(devices) }
  setTransferStatus(status: TransferStatus): void { this.transfers.set(status) }
  reportProgress(progress: TransferProgress): void { this.transfers.report(progress) }
  declareAction(descriptor: ActionDescriptor): void { this.actions.push(descriptor) }
  isSynraError(value: unknown): value is SynraError { return isSynraErrorValue(value) }
  isCode(value: unknown, code: ErrorCode): boolean { return errorSnapshot(value)?.code === code }
  isCapabilityDenied(value: unknown): value is SynraError & { code: 'capability_denied' } {
    return errorSnapshot(value)?.code === 'capability_denied'
  }

  ready(): void { this.readyCalls++ }
  get readyCount(): number { return this.readyCalls }
  requestId(): string { return this.id('request') }
  private id(kind: 'request' | 'transfer'): string {
    return this.options.nextId?.(kind) ?? `mock-${kind}-${String(++this.nextId)}`
  }
}

export function createMockClient(options: MockOptions = {}): MockSynraClient {
  return new MockSynraClient(options)
}
