import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { kernelCandidates } from './parsers'

export interface ShapeContext {
  jsRoot: string
  protocolDirectory: string
  dtoDirectory: string
  metricsDirectory: string
  evidence: string[]
  problems: { where: string, what: string }[]
  read: (path: string) => string
  fail: (where: string, what: string) => void
}

export function createShapeContext(): ShapeContext {
  const jsRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
  const coreRoot = kernelCandidates(jsRoot, process.env.SYNRA_CORE_ROOT).find(candidate => existsSync(candidate))
    ?? join(jsRoot, '..', 'synra-rust-core')
  const problems: ShapeContext['problems'] = []
  return {
    jsRoot,
    protocolDirectory: join(coreRoot, 'crates/synra-protocol/src'),
    dtoDirectory: join(coreRoot, 'crates/synra-ipc/src/dto'),
    metricsDirectory: join(coreRoot, 'crates/synra-observe/src/metrics'),
    evidence: [],
    problems,
    read: path => readFileSync(path, 'utf8'),
    fail: (where, what) => problems.push({ where, what }),
  }
}
