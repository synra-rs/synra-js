import type { ErrorCode, SynraError } from '@synra/protocol'
import type { ErrorSnapshot } from './shape.js'
import { ERROR_RETRYABLE } from './catalog.js'
import { diagnostic, diagnosticText } from './diagnostics.js'
import { data, errorSnapshot } from './shape.js'

export { isSynraErrorValue } from './shape.js'

export function createSynraError(code: ErrorCode, details?: unknown): SynraError {
  return {
    code,
    message: `error.${code}`,
    retryable: ERROR_RETRYABLE[code],
    ...(details === undefined ? {} : { details: diagnostic(details) }),
  }
}

/** IPC parameters remain diagnostic and cannot override the public classification. */
export function asSynraError(reason: unknown): SynraError {
  const snapshot = errorSnapshot(reason)
  if (snapshot === undefined)
    return unknownError(reason)
  return fromSnapshot(snapshot)
}

function unknownError(reason: unknown): SynraError {
  const message = data(reason, 'message')
  const detail = typeof reason === 'string' ? reason : typeof message === 'string' ? message : 'unrecognized bridge failure'
  return createSynraError('internal', { detail })
}

function fromSnapshot(snapshot: ErrorSnapshot): SynraError {
  const { code, message, retryable, params, details: context, actions, traceId } = snapshot
  const details = params === undefined ? context : { params, context }
  return {
    code,
    message: diagnosticText(message),
    retryable,
    ...(actions === undefined ? {} : { actions }),
    ...(traceId === undefined ? {} : { traceId: diagnosticText(traceId) }),
    ...(details === undefined ? {} : { details: diagnostic(details) }),
  }
}
