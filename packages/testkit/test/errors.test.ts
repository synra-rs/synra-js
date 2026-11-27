import { describe, expect, it } from 'vitest'
import { MockSynraClient, synraError } from '../src/index'

describe('the error constructor', () => {
  it('carries what the type requires', () => {
    const error = synraError('timeout', 'too slow', { retryable: true, traceId: 't1' })
    expect(error).toEqual({ code: 'timeout', message: 'too slow', retryable: true, traceId: 't1' })
  })

  it('defaults to not retryable', () => {
    // The safe default: telling a caller to retry something that cannot succeed makes it retry forever.
    expect(synraError('invalid_argument', 'bad').retryable).toBe(false)
  })

  it('omits absent optional fields rather than writing undefined', () => {
    // `exactOptionalPropertyTypes` makes the distinction visible, and the wire format would reject an
    // explicit `null` where a field is absent.
    const error = synraError('internal', 'x')
    expect('traceId' in error).toBe(false)
    expect('actions' in error).toBe(false)
  })

  it('is recognised by the mock own predicate', () => {
    const synra = new MockSynraClient()
    expect(synra.isSynraError(synraError('internal', 'x'))).toBe(true)
    expect(synra.isSynraError(new Error('plain'))).toBe(false)
    expect(synra.isSynraError(null)).toBe(false)
    expect(synra.isCode(synraError('timeout', 'x'), 'timeout')).toBe(true)
  })
})
