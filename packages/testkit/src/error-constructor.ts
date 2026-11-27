import type { SynraError } from '@synra/client'
import type { ErrorCode, SuggestedAction } from '@synra/protocol'
import { ERROR_RETRYABLE } from './errors/catalog.js'

/** Error fixture with the core retry policy unless explicitly overridden. */
export function synraError(code: ErrorCode, message: string, extra?: {
  readonly retryable?: boolean
  readonly traceId?: string
  readonly actions?: readonly SuggestedAction[]
}): SynraError {
  return {
    code,
    message,
    retryable: extra?.retryable ?? ERROR_RETRYABLE[code],
    ...(extra?.actions === undefined ? {} : { actions: extra.actions }),
    ...(extra?.traceId === undefined ? {} : { traceId: extra.traceId }),
  }
}
