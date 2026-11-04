/** Host-only pointer consent; pairing never implies permission to control a computer. */
export type InputPhase = 'pending' | 'starting' | 'active' | 'ended'

export interface InputSession {
  readonly sessionId: string
  readonly deviceId: string
  readonly displayName: string
  readonly pluginId: string
  readonly phase: InputPhase
  readonly reason?: string
}

export interface InputSnapshot {
  readonly session?: InputSession
}
