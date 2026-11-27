import { describe, expect, it } from 'vitest'
import { createMockClient } from '../src/index'

describe('logging', () => {
  it('records every level', () => {
    const synra = createMockClient()
    synra.log.trace('t')
    synra.log.debug('d')
    synra.log.info('i')
    synra.log.warn('w')
    synra.log.error('e')
    expect(synra.calls.filter(call => call.ns === 'log')).toHaveLength(5)
  })

  it('prefixes a child logger onto the message', () => {
    const synra = createMockClient()
    const child = synra.log.child('chat')
    child.info('sent')
    expect(synra.lastArgs('log', 'info')).toEqual(['chat sent', undefined])
  })

  it('nests child prefixes', () => {
    const synra = createMockClient()
    synra.log.child('chat').child('outbox').info('sent')
    expect(synra.lastArgs('log', 'info')?.[0]).toBe('chat outbox sent')
  })
})
