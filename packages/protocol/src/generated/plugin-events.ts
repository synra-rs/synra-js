/** Public page stream from synra-ipc/src/event/plugin.rs. */
import type { PluginTransferStatus } from './ui-transfer'
import type { DeviceId } from './wire'

export type PluginDevicePlatform = 'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'desktop' | 'headless'

export interface PluginDeviceTarget {
  readonly deviceId: DeviceId
  readonly displayName: string
  readonly platform: PluginDevicePlatform
  readonly online: boolean
}

export interface PluginDevicesChanged {
  readonly devices: readonly PluginDeviceTarget[]
}

export type PluginCustomEventName = `_plugin.${string}.${string}`

export interface PluginCustomEvent {
  readonly name: PluginCustomEventName
  readonly payload: Readonly<Record<string, unknown>>
}

export type PluginEvent
  = | { readonly name: 'device.changed', readonly payload: PluginDevicesChanged }
    | { readonly name: 'transfer.progress', readonly payload: PluginTransferStatus }
    | PluginCustomEvent

export type PluginEventEnvelope = PluginEvent & { readonly seq: number, readonly at: number }

export type PluginEventPoll = PluginEventEnvelope | { readonly resync: true }

export interface PluginEventRecovery {
  readonly seq: number
  readonly events: readonly PluginEvent[]
  readonly unreplayedSubscriptionIds?: readonly number[]
}
