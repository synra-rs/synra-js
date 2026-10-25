/* eslint-disable */
/**
 * Handwritten mirror checked against synra-protocol/src/credentials.rs.
 * Verified by scripts/check-shapes.ts; this file is not generated.
 */
import type { ErrorCode } from './wire'

export interface CredentialEnrollment {
  readonly fingerprint: string
  readonly backend: string
  readonly ready: boolean
}

export interface CredentialRecovery {
  readonly fingerprint: string
  readonly backend: string
}

export interface CredentialSnapshot {
  readonly deviceId: string
  readonly enrollment: CredentialEnrollment | null
  readonly recovery: CredentialRecovery | null
  readonly retiredKeys: number
  readonly runtimeReady: boolean
  readonly restartRequired: boolean
}

export interface CredentialCleanupReport {
  readonly remaining: number | null
  readonly errorCode: ErrorCode | null
  readonly detail: string | null
}

export interface CredentialRepairReport {
  readonly deviceId: string
  readonly fingerprint: string
  readonly restartRequired: boolean
  readonly cleanup: CredentialCleanupReport
}
