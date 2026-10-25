import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { expect, it } from 'vitest'

import { kernelCandidates } from './check-shapes'
import { requiredRecordProblems } from './pairing-shapes'

const rust = kernelCandidates(process.cwd(), process.env.SYNRA_CORE_ROOT).flatMap((root) => {
  try {
    return [readFileSync(resolve(root, 'crates/synra-protocol/src/credentials.rs'), 'utf8')]
  }
  catch {
    return []
  }
})[0]
if (rust === undefined)
  throw new Error('credential shape checks require the core checkout')
const ts = readFileSync('packages/protocol/src/generated/credentials.ts', 'utf8')

it('compares the actual required nullable maintenance records', () => {
  for (const name of ['CredentialEnrollment', 'CredentialRecovery', 'CredentialSnapshot', 'CredentialCleanupReport', 'CredentialRepairReport'])
    expect(requiredRecordProblems(rust, ts, name)).toEqual([])
})

it('refuses a field that starts omitting null values', () => {
  const changed = rust.replace('pub remaining:', '#[serde(skip_serializing_if = "Option::is_none")]\n    pub remaining:')
  expect(changed).not.toBe(rust)
  expect(requiredRecordProblems(changed, ts, 'CredentialCleanupReport')).not.toEqual([])
})

it.each([
  ['CredentialSnapshot', 'enrollment: CredentialEnrollment | null', 'enrollment?: CredentialEnrollment'],
  ['CredentialSnapshot', 'recovery: CredentialRecovery | null', 'recovery?: CredentialRecovery'],
  ['CredentialRecovery', 'fingerprint: string', 'fingerprint: number'],
  ['CredentialCleanupReport', 'remaining: number | null', 'remaining: number'],
  ['CredentialRepairReport', 'restartRequired: boolean', 'restartRequired: string'],
])('detects nullable optional and primitive type drift in %s', (name, from, to) => {
  expect(ts).toContain(from)
  expect(requiredRecordProblems(rust, ts.replaceAll(from, to), name)).not.toEqual([])
})
