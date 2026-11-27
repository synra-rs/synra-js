import type { ClientFeature, PlatformCapability } from '@synra/client'

/** Method availability, independent of the plugin's grants and the operating system. */
export interface MockHostProfile {
  readonly features: readonly ClientFeature[]
  readonly unavailable?: readonly string[]
}

/** All APIs the testkit can model. This profile does not describe an installed application. */
export const SIMULATED_PROFILE: MockHostProfile = Object.freeze({
  features: Object.freeze(['device.onChange', 'device.pick', 'transfer.onProgress', 'event.subscribe', 'network.fetch', 'clipboard.read'] as const),
})

/** Current App API implementation; platform support and grants must still be supplied. */
export const APP_PROFILE: MockHostProfile = Object.freeze({
  features: Object.freeze(['device.onChange', 'transfer.onProgress', 'event.subscribe', 'network.fetch', 'clipboard.read'] as const),
  unavailable: Object.freeze(['device.send', 'device.broadcast', 'event.emit']),
})

export interface HostProfileSnapshot {
  readonly features: readonly ClientFeature[]
  readonly unavailable: ReadonlySet<string>
  readonly platform: ReadonlySet<PlatformCapability>
}

export function snapshotProfile(
  profile: MockHostProfile,
  features: readonly ClientFeature[] | undefined,
  platform: readonly PlatformCapability[],
): HostProfileSnapshot {
  const unavailable = new Set(profile.unavailable ?? [])
  return {
    features: Object.freeze([...new Set(features ?? profile.features)].filter(feature => !unavailable.has(feature))),
    unavailable,
    platform: new Set(platform),
  }
}
