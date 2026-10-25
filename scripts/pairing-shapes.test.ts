import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { expect, it } from 'vitest'

import { kernelCandidates } from './check-shapes'
import { pairingShapeProblems } from './pairing-shapes'

const roots = kernelCandidates(process.cwd(), process.env.SYNRA_CORE_ROOT)
const rust = roots.flatMap((root) => {
  try {
    return [readFileSync(resolve(root, 'crates/synra-protocol/src/pairing.rs'), 'utf8')]
  }
  catch {
    return []
  }
})[0]
if (rust === undefined)
  throw new Error('pairing shape tests require the core checkout')
const ts = readFileSync('packages/protocol/src/generated/ui.ts', 'utf8')

it('checks the real task contract including explicit nulls', () => {
  expect(pairingShapeProblems(rust, ts)).toEqual([])
})

it.each([
  ['\'timedOut\'', '\'expired\''],
  ['readonly reply: string | null', 'readonly reply: string'],
  ['readonly errorCode:', 'readonly errorCode?:'],
  ['readonly expiresAtMs: number', 'readonly expiresAtMs: string'],
])('rejects a changed phase type or nullable field %s', (from, to) => {
  expect(ts).toContain(from)
  expect(pairingShapeProblems(rust, ts.replace(from, to))).not.toEqual([])
})
