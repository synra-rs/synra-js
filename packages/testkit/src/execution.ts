import type { ClientFeature, PlatformCapability, SynraError } from '@synra/client'
import type { HostProfileSnapshot } from './profile.js'
import { CapabilityPolicy } from './capabilities.js'
import { synraError } from './error-constructor.js'
import { asSynraError, createSynraError } from './errors/index.js'

export interface RecordedCall {
  readonly ns: string
  readonly method: string
  readonly args: readonly unknown[]
  readonly refused?: SynraError
}

interface MutableCall extends RecordedCall {
  refused?: SynraError
}

export interface CallPolicy {
  readonly feature?: ClientFeature
  readonly capability?: string
  readonly platform?: PlatformCapability
  /** Domain validation and authorization that depends on actual arguments. */
  readonly validate?: () => void
}

type Stub = { kind: 'value', value: unknown } | { kind: 'failure', reason: unknown }

/** All model methods enter here, including subscription setup and refusals. */
export class MockExecution {
  readonly calls: RecordedCall[] = []
  readonly capabilities: CapabilityPolicy
  private readonly stubs = new Map<string, Stub>()

  constructor(readonly profile: HostProfileSnapshot, grants: readonly string[]) {
    this.capabilities = new CapabilityPolicy(grants)
  }

  stub(ns: string, method: string, value: unknown): void {
    this.stubs.set(`${ns}.${method}`, { kind: 'value', value })
  }

  stubFailure(ns: string, method: string, reason: unknown): void {
    this.stubs.set(`${ns}.${method}`, { kind: 'failure', reason })
  }

  require(capability: string): void {
    if (!this.capabilities.can(capability)) {
      throw synraError('capability_denied', `the plugin has not been granted ${capability}`, {
        actions: [{ kind: 'requestCapability', capability }],
      })
    }
  }

  private check(ns: string, method: string, policy: CallPolicy): void {
    if (this.profile.unavailable.has(`${ns}.${method}`)
      || (policy.feature !== undefined && !this.profile.features.includes(policy.feature))) {
      throw createSynraError('unsupported', { feature: `${ns}.${method}` })
    }
    if (policy.capability !== undefined)
      this.require(policy.capability)
    policy.validate?.()
    // Production checks the grant before reaching the native platform runner.
    if (policy.platform !== undefined && !this.profile.platform.has(policy.platform))
      throw synraError('unsupported', `this platform does not support ${policy.platform}`)
  }

  private result<T>(ns: string, method: string, operation: () => T): T {
    const stub = this.stubs.get(`${ns}.${method}`)
    if (stub?.kind === 'failure')
      throw stub.reason
    return stub?.kind === 'value' ? stub.value as T : operation()
  }

  sync<T>(ns: string, method: string, args: readonly unknown[], operation: () => T, policy: CallPolicy = {}): T {
    const call: MutableCall = { ns, method, args }
    this.calls.push(call)
    try {
      this.check(ns, method, policy)
      return this.result(ns, method, operation)
    }
    catch (reason) {
      call.refused = asSynraError(reason)
      throw call.refused
    }
  }

  async run<T>(ns: string, method: string, args: readonly unknown[], operation: () => T | Promise<T>, policy: CallPolicy = {}): Promise<T> {
    const call: MutableCall = { ns, method, args }
    this.calls.push(call)
    try {
      this.check(ns, method, policy)
      return await this.result(ns, method, operation)
    }
    catch (reason) {
      call.refused = asSynraError(reason)
      throw call.refused
    }
  }
}
