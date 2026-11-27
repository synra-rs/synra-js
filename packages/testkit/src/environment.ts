import type { EnvNamespace, LogNamespace } from '@synra/client'
import type { MockExecution } from './execution.js'
import type { MockOptions } from './options.js'

export function createEnvironment(execution: MockExecution, options: MockOptions): EnvNamespace {
  return {
    hostKind: () => options.env?.hostKind ?? 'desktop',
    platform: () => options.env?.platform ?? 'linux',
    locale: () => options.env?.locale ?? 'en',
    darkMode: () => options.env?.darkMode ?? false,
    appVersion: () => options.env?.appVersion ?? '0.0.0-mock',
    sdkVersion: () => options.env?.sdkVersion ?? '0.1.0',
    webview: () => options.env?.webview ?? { kind: 'unknown', version: null },
    hostSupports: feature => execution.sync('env', 'hostSupports', [feature], () => execution.profile.features.includes(feature)),
    platformSupports: capability => execution.sync('env', 'platformSupports', [capability], () => execution.profile.platform.has(capability)),
    can: capability => execution.sync('env', 'can', [capability], () => execution.capabilities.can(capability)),
  }
}

export function createLog(execution: MockExecution, prefix = ''): LogNamespace {
  const emit = (level: string) => (message: string, context?: Record<string, unknown>): void =>
    execution.sync('log', level, [prefix ? `${prefix} ${message}` : message, context], () => undefined)
  return {
    trace: emit('trace'),
    debug: emit('debug'),
    info: emit('info'),
    warn: emit('warn'),
    error: emit('error'),
    child: inner => createLog(execution, prefix ? `${prefix} ${inner}` : inner),
  }
}
