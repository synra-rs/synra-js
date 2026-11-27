import type { ClipboardNamespace, PlatformNamespace } from '@synra/client'
import type { MockExecution } from './execution.js'

export function createPlatform(execution: MockExecution): PlatformNamespace {
  return {
    openUrl: async url => execution.run('platform', 'openUrl', [url], () => undefined, { capability: 'platform:open-url', platform: 'open_url' }),
    notify: async req => execution.run('platform', 'notify', [req], () => undefined, { capability: 'platform:notify', platform: 'notify' }),
  }
}

export function createClipboard(execution: MockExecution): ClipboardNamespace {
  return {
    read: async () => execution.run('clipboard', 'read', [], () => '', { feature: 'clipboard.read', capability: 'platform:read-clipboard', platform: 'clipboard_read' }),
    write: async text => execution.run('clipboard', 'write', [text], () => undefined, { capability: 'platform:write-clipboard', platform: 'clipboard_write' }),
  }
}
