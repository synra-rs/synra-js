import type { ClientFeature, DeviceTarget, PlatformCapability, WebviewInfo } from '@synra/client'
import type { DeviceId, PluginId } from '@synra/protocol'
import type { MockHostProfile } from './profile.js'

/** Explicit external outcomes and host facts for a local protocol substitute. */
export interface MockOptions {
  readonly capabilities?: readonly string[]
  /** Paired and unblocked devices, including offline devices. */
  readonly devices?: readonly DeviceTarget[]
  readonly platformCapabilities?: readonly PlatformCapability[]
  /** Defaults to SIMULATED_PROFILE; use APP_PROFILE to model current App availability. */
  readonly profile?: MockHostProfile
  readonly hostFeatures?: readonly ClientFeature[]
  /** User selection fixture; null means cancelled, absence means no selection was provided. */
  readonly pickedDevice?: DeviceId | null
  readonly env?: {
    readonly hostKind?: 'desktop' | 'mobile'
    readonly platform?: 'windows' | 'macos' | 'linux' | 'android' | 'ios'
    readonly locale?: string
    readonly darkMode?: boolean
    readonly appVersion?: string
    readonly sdkVersion?: string
    readonly webview?: WebviewInfo
  }
  readonly pluginId?: PluginId
  /** Deterministic IDs without clocks or randomness. */
  readonly nextId?: (kind: 'request' | 'transfer') => string
}
