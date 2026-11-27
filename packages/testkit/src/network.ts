import type { NetworkNamespace, SynraFetchInit, SynraResponse } from '@synra/client'
import type { MockExecution } from './execution.js'
import { parseCapability } from './capabilities.js'
import { createSynraError } from './errors/index.js'

/** One byte source for all mutually exclusive response readers. Each fixture is one response. */
export function createMockResponse(body: string | Uint8Array, options: {
  readonly status?: number
  readonly statusText?: string
  readonly headers?: Readonly<Record<string, string>>
  readonly url?: string
  readonly redirected?: boolean
} = {}): SynraResponse {
  const bytes = typeof body === 'string' ? new TextEncoder().encode(body) : body.slice()
  let consumed = false
  const consume = (): Uint8Array => {
    if (consumed)
      throw createSynraError('invalid_argument', { reason: 'the response body has already been read' })
    consumed = true
    return bytes.slice()
  }
  const status = options.status ?? 200
  return {
    status,
    statusText: options.statusText ?? '',
    headers: Object.fromEntries(Object.entries(options.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value])),
    url: options.url ?? '',
    redirected: options.redirected ?? false,
    ok: status >= 200 && status < 300,
    text: async () => new TextDecoder().decode(consume()),
    bytes: async () => consume(),
    json: async (): Promise<unknown> => {
      const text = new TextDecoder().decode(consume())
      try {
        return JSON.parse(text)
      }
      catch {
        throw createSynraError('invalid_argument', { reason: 'the response body is not JSON' })
      }
    },
  }
}

function hasForbiddenUrlCharacter(input: string): boolean {
  for (const character of input) {
    const code = character.charCodeAt(0)
    if (code <= 32 || (code >= 127 && code <= 159) || character === '\\')
      return true
  }
  return false
}

function authorize(execution: MockExecution, input: string, init: SynraFetchInit): void {
  if (init.timeoutMs !== undefined || (init.body !== undefined && typeof init.body !== 'string'))
    throw createSynraError('unsupported', { feature: 'network.fetch request options' })
  if (new TextEncoder().encode(input).length > 2048 || hasForbiddenUrlCharacter(input) || !/^https?:\/\/[^/?#]/i.test(input))
    throw createSynraError('invalid_argument')
  let url: URL
  try {
    url = new URL(input)
  }
  catch {
    throw createSynraError('invalid_argument')
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '')
  const method = init.method ?? 'GET'
  const destination = `network:fetch:${host}`
  const operation = `${destination}:${method}`
  if (host.includes('*') || parseCapability(operation) === undefined || !['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].includes(method))
    throw createSynraError('invalid_argument')
  if (!execution.capabilities.can(destination))
    execution.require(operation)
}

export function createNetwork(execution: MockExecution): NetworkNamespace {
  return {
    fetch: async (input, init) => execution.run('network', 'fetch', init === undefined ? [input] : [input, init], () => {
      throw createSynraError('internal', { reason: 'network.fetch requires an explicit response stub' })
    }, { feature: 'network.fetch', validate: () => authorize(execution, input, init ?? {}) }),
  }
}
