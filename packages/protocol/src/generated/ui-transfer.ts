import type { TransferAbortReason, TransferId } from './wire'

export type PluginTransferState = 'pending' | 'transferring' | 'completed' | 'failed' | 'cancelled'

export type PluginTransferFailure
  = | { readonly kind: 'connection' | 'timed_out' | 'authorization' | 'file_io' | 'integrity' | 'protocol' | 'worker_unavailable' }
    | { readonly kind: 'peer_aborted', readonly reason: TransferAbortReason }

/** Current or retained state of a transfer this plugin started. */
export interface PluginTransferStatus {
  readonly transferId: TransferId
  readonly state: PluginTransferState
  readonly receivedBytes: number
  readonly totalBytes: number
  readonly blocksDone: number
  readonly blocksTotal: number
  /** Advances when the worker records a change. */
  readonly revision: number
  /** Present after the worker exits. Unix milliseconds. */
  readonly endedAtMs?: number
  /** Present on a failed transfer. */
  readonly failure?: PluginTransferFailure
}
