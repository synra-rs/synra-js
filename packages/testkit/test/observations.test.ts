import type { TransferProgress } from '@synra/client'
import { describe, expect, it, vi } from 'vitest'
import { createMockClient } from '../src/index'
import { devices, expectCode } from './fixtures'

describe('device changes and transfer progress', () => {
  it('notifies device watchers when the set changes', () => {
    const synra = createMockClient({ capabilities: ['device:list'], hostFeatures: ['device.onChange'], devices })
    const handler = vi.fn()
    const unsubscribe = synra.device.onChange(handler)
    synra.setDevices([devices[0]!])
    expect(handler).toHaveBeenCalledWith([devices[0]])
    unsubscribe()
    synra.setDevices([])
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('notifies progress watchers for one transfer only', () => {
    const synra = createMockClient({ hostFeatures: ['transfer.onProgress'] })
    const handler = vi.fn()
    synra.transfer.onProgress('t1', handler)
    const progress: TransferProgress = {
      transferId: 't2',
      state: 'transferring',
      receivedBytes: 1,
      totalBytes: 2,
      ratio: 0.5,
    }
    // A different transfer's progress must not reach this handler, or a UI showing two transfers
    // would update the wrong bar.
    synra.reportProgress(progress)
    expect(handler).not.toHaveBeenCalled()

    synra.reportProgress({ ...progress, transferId: 't1' })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('returns a transfer id from a send', async () => {
    const synra = createMockClient({ capabilities: ['file:transfer:send'] })
    const id = await synra.transfer.send({
      to: 'dev_a',
      file: new Blob(['x']),
      fileName: 'x.txt',
    })
    expect(id).toMatch(/^mock-transfer-/)
  })

  it('refuses a transfer without the capability', async () => {
    const synra = createMockClient({ capabilities: [] })
    await expectCode(
      synra.transfer.send({ to: 'dev_a', file: new Blob(['x']), fileName: 'x.txt' }),
      'capability_denied',
    )
  })
})
