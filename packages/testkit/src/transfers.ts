import type { TransferNamespace, TransferProgress, TransferStatus } from '@synra/client'
import type { TransferId } from '@synra/protocol'
import type { MockEvents } from './events.js'
import type { MockExecution } from './execution.js'
import { createSynraError } from './errors/index.js'

/** Observable fixture state only; no network transport or automatic completion. */
export class MockTransfers {
  private readonly states = new Map<TransferId, TransferStatus>()
  readonly namespace: TransferNamespace

  constructor(execution: MockExecution, nextId: () => TransferId, private readonly events: MockEvents) {
    this.namespace = {
      send: async req => execution.run('transfer', 'send', [req], () => {
        const transferId = nextId()
        this.states.set(transferId, {
          transferId,
          state: 'pending',
          receivedBytes: 0,
          totalBytes: req.file.size,
          blocksDone: 0,
          // The simulated transport treats the blob as one block. Fixtures can report a multi-block send.
          blocksTotal: 1,
          revision: 0,
        })
        return transferId
      }, {
        capability: 'file:transfer:send',
        validate: () => {
          if (req.contextId !== undefined)
            throw createSynraError('unsupported', { feature: 'transfer.send contextId' })
        },
      }),
      status: async id => execution.run('transfer', 'status', [id], () => {
        const state = this.states.get(id)
        if (state === undefined)
          throw createSynraError('invalid_argument', { transferId: id, reason: 'transfer_not_found' })
        return { ...state }
      }, { capability: 'file:transfer:send' }),
      onProgress: (id, handler, options) => execution.sync('transfer', 'onProgress', [id], () => {
        let active = true
        let revision = -1
        const emit = (state: TransferStatus): void => {
          if (active && state.revision > revision) {
            revision = state.revision
            handler({ ...state, ratio: state.totalBytes === 0 ? 0 : Math.min(1, state.receivedBytes / state.totalBytes) })
          }
        }
        const off = this.states.has(id) ? events.onTransfer(id, emit, options) : undefined
        queueMicrotask(() => {
          if (!active)
            return
          const current = this.states.get(id)
          if (off === undefined || current === undefined)
            events.report(createSynraError('invalid_argument', { transferId: id, reason: 'transfer_not_found' }), options)
          else
            events.notify(emit, current, options)
        })
        return () => {
          active = false
          off?.()
        }
      }, { feature: 'transfer.onProgress', capability: 'file:transfer:send' }),
    }
  }

  set(status: TransferStatus): void {
    this.states.set(status.transferId, { ...status })
  }

  report(progress: TransferProgress): void {
    const { ratio: _, ...status } = progress
    const previous = this.states.get(status.transferId)
    if (previous !== undefined && (previous.revision >= status.revision || previous.endedAtMs !== undefined))
      return
    this.set(status)
    this.events.deliver('transfer.progress', status)
  }
}
