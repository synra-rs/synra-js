import type { DeviceNamespace, DeviceTarget } from '@synra/client'
import type { MockExecution } from './execution.js'
import type { MockOptions } from './options.js'
import { createSynraError } from './errors/index.js'

export class MockDevices {
  private devices: DeviceTarget[]
  private readonly watchers = new Set<(devices: DeviceTarget[]) => void>()
  readonly namespace: DeviceNamespace

  constructor(execution: MockExecution, options: MockOptions) {
    this.devices = [...(options.devices ?? [])]
    this.namespace = {
      list: async () => execution.run('device', 'list', [], () => [...this.devices], { capability: 'device:list' }),
      send: async req => execution.run('device', 'send', [req], () => undefined, { capability: `device:send:${req.to}` }),
      broadcast: async req => execution.run('device', 'broadcast', [req], () => undefined, { capability: 'device:broadcast' }),
      onChange: handler => execution.sync('device', 'onChange', [], () => {
        this.watchers.add(handler)
        return () => {
          this.watchers.delete(handler)
        }
      }, { feature: 'device.onChange' }),
      pick: async optionsForPicker => execution.run('device', 'pick', [optionsForPicker], () => {
        if (options.pickedDevice === undefined)
          throw createSynraError('internal', { reason: 'device.pick requires an explicit pickedDevice fixture or stub' })
        return options.pickedDevice
      }, { feature: 'device.pick' }),
      supported: execution.profile.features,
    }
  }

  set(devices: readonly DeviceTarget[]): void {
    this.devices = [...devices]
    for (const watcher of [...this.watchers])
      watcher([...this.devices])
  }
}
