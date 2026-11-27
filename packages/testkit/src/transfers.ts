import type { TransferNamespace, TransferProgress, TransferStatus } from '@synra/client'
import type { TransferId } from '@synra/protocol'
import type { MockExecution } from './execution.js'
import { createSynraError } from './errors/index.js'

/** Observable fixture state only; no network transport or automatic completion. */
export class MockTransfers {
  private readonly states = new Map<TransferId, TransferStatus>()
  private readonly watchers = new Map<TransferId, Set<(progress: TransferProgress) => void>>()
  readonly namespace: TransferNamespace

  constructor(execution: MockExecution, nextId: () => TransferId) {
    this.namespace = {
      send: async req => execution.run('transfer', 'send', [req], () => {
        const transferId = nextId()
        this.states.set(transferId, { transferId, state: 'pending', receivedBytes: 0, totalBytes: req.file.size })
        return transferId
      }, { capability: 'file:transfer:send' }),
      status: async id => execution.run('transfer', 'status', [id], () => {
        const state = this.states.get(id)
        if (state === undefined)
          throw createSynraError('invalid_argument', { field: 'transferId', reason: 'unknown transfer' })
        return { ...state }
      }),
      onProgress: (id, handler) => execution.sync('transfer', 'onProgress', [id], () => {
        const handlers = this.watchers.get(id) ?? new Set()
        handlers.add(handler)
        this.watchers.set(id, handlers)
        return () => {
          handlers.delete(handler)
          if (handlers.size === 0)
            this.watchers.delete(id)
        }
      }, { feature: 'transfer.onProgress' }),
    }
  }

  set(status: TransferStatus): void {
    this.states.set(status.transferId, { ...status })
  }

  report(progress: TransferProgress): void {
    this.set(progress)
    for (const watcher of [...(this.watchers.get(progress.transferId) ?? [])])
      watcher(progress)
  }
}
