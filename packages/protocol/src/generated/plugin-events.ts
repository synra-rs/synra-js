/** Public page stream from synra-ipc/src/event/plugin.rs. */
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

export type PluginEvent = { readonly name: 'device.changed', readonly payload: PluginDevicesChanged }

export type PluginEventEnvelope = PluginEvent & { readonly seq: number, readonly at: number }
