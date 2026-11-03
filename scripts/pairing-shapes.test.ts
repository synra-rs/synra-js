import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { expect, it } from 'vitest'

import { pairingShapeProblems } from './pairing-shapes'
import { kernelCandidates } from './shapes/parsers'

const roots = kernelCandidates(process.cwd(), process.env.SYNRA_CORE_ROOT)
const rust = roots.flatMap((root) => {
  try {
    return [readFileSync(resolve(root, 'crates/synra-ipc/src/dto/pairing.rs'), 'utf8')]
  }
  catch {
    return []
  }
})[0]
if (rust === undefined)
  throw new Error('pairing shape tests require the core checkout')
const ts = readFileSync('packages/protocol/src/generated/ui.ts', 'utf8')

it('checks the real pairing DTO including omitted Option fields', () => {
  expect(pairingShapeProblems(rust, ts)).toEqual([])
})

it.each([
  ['\'timedOut\'', '\'expired\''],
  ['readonly offer?: PairingOffer', 'readonly offer: PairingOffer'],
  ['readonly ask?: PairingAsk', 'readonly ask?: string'],
  ['readonly outcome?: PairingOutcome', 'readonly outcome?: PairingOutcome | null'],
])('rejects a changed phase type or nullable field %s', (from, to) => {
  expect(ts).toContain(from)
  expect(pairingShapeProblems(rust, ts.replace(from, to))).not.toEqual([])
})
