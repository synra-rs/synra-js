import type { DeviceNamespace, DeviceTarget } from '@synra/client'
import type { MockEvents } from './events.js'
import type { MockExecution } from './execution.js'
import type { MockOptions } from './options.js'
import { createSynraError } from './errors/index.js'

export class MockDevices {
  private devices: DeviceTarget[]
  readonly namespace: DeviceNamespace

  constructor(execution: MockExecution, options: MockOptions, private readonly events: MockEvents) {
    this.devices = [...(options.devices ?? [])]
    this.namespace = {
      list: async () => execution.run('device', 'list', [], () => [...this.devices], { capability: 'device:list' }),
      send: async req => execution.run('device', 'send', [req], () => undefined, { capability: `device:send:${req.to}` }),
      broadcast: async req => execution.run('device', 'broadcast', [req], () => undefined, { capability: 'device:broadcast' }),
      onChange: (handler, options) => execution.sync('device', 'onChange', [], () => this.events.onDevices(payload => handler([...payload.devices]), options), { feature: 'device.onChange', capability: 'device:list' }),
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
    this.events.deliver('device.changed', { devices: [...this.devices] })
  }
}
