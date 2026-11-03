import type { ShapeContext } from './context'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pairingShapeProblems, requiredRecordProblems } from '../pairing-shapes'
import { evaluateProduct, rustConvention, rustErrorCodes, tsErrorCodes } from './parsers'

export function checkProtocol(context: ShapeContext): void {
  const { jsRoot, protocolDirectory: PROTOCOL_CRATE, read, fail, evidence } = context
  const RUST_CONVENTIONS: Record<string, string | null> = {
    // 身份别名：TS 里是 string，没有字段
    DeviceId: null,
    PluginId: null,
    IntentId: null,
    TransferId: null,
    RequestId: null,
    EventName: null,
    TraceId: null,
    // 错误
    ErrorCode: 'snake_case',
    SuggestedAction: 'camelCase',
    SynraError: 'camelCase',
    // 信封
    Envelope: 'camelCase',
    // 会话
    PlatformKind: 'snake_case',
    PairingPhase: 'camelCase',
    PairingSnapshot: 'camelCase',
    CredentialEnrollment: 'camelCase',
    CredentialRecovery: 'camelCase',
    CredentialSnapshot: 'camelCase',
    CredentialCleanupReport: 'camelCase',
    CredentialRepairReport: 'camelCase',
    IntentDisplay: 'camelCase',
    IntentInvocation: 'camelCase',
    IntentOutcome: 'camelCase',
    // 传输
    TransferKind: 'kebab-case',
    DigestAlgorithm: 'lowercase',
    TransferProgress: 'camelCase',
    TransferAbortReason: 'snake_case',
  }

  const wirePath = join(jsRoot, 'packages', 'protocol', 'src', 'generated', 'wire.ts')
  const wire = read(wirePath)

  const rustFiles = existsSync(PROTOCOL_CRATE)
    ? readdirSync(PROTOCOL_CRATE).filter(name => name.endsWith('.rs'))
    : []

  const rustSource
    = rustFiles.length > 0
      ? [...rustFiles.map(name => read(join(PROTOCOL_CRATE, name))), read(join(context.dtoDirectory, 'pairing.rs'))].join('\n')
      : null

  if (rustSource === null) {
    // 没有 Rust 源码时不失败：这个仓库可以在只 checkout 了自己的 CI 里跑。但要说出来，否则守卫看起
    // 来通过了而其实什么都没查 —— 那比失败更糟。
    console.warn(
      [
        `! the Rust protocol crate was not found at ${PROTOCOL_CRATE}`,
        '  the checks that compare against Rust were skipped.',
        '  put `synra-rust-core` beside this repository, or name the directory with SYNRA_CORE_ROOT.',
      ].join('\n'),
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1 · 大小写约定
  // ─────────────────────────────────────────────────────────────────────────────

  if (rustSource !== null) {
    let checked = 0
    for (const [typeName, expected] of Object.entries(RUST_CONVENTIONS)) {
      if (expected === null)
        continue
      checked += 1
      const actual = rustConvention(rustSource, typeName)
      if (actual === null) {
        fail('rust', `${typeName} has no #[serde(rename_all = …)] in the protocol crate`)
        continue
      }
      if (actual !== expected) {
        fail(`conventions:${typeName}`, `the table says ${expected} and the Rust crate says ${actual}`)
      }
    }
    evidence.push(`${String(checked)} naming conventions checked against Rust`)
    for (const problem of pairingShapeProblems(rustSource, read(join(jsRoot, 'packages/protocol/src/generated/ui.ts'))))
      fail('pairing-contract', problem)
    const credentials = read(join(jsRoot, 'packages/protocol/src/generated/credentials.ts'))
    for (const name of ['CredentialEnrollment', 'CredentialRecovery', 'CredentialSnapshot', 'CredentialCleanupReport', 'CredentialRepairReport']) {
      for (const problem of requiredRecordProblems(rustSource, credentials, name))
        fail('credential-contract', problem)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2 · 错误码
  // ─────────────────────────────────────────────────────────────────────────────

  if (rustSource !== null) {
    const expected = rustErrorCodes(rustSource).sort()
    const actual = tsErrorCodes(wire).sort()

    if (expected.length === 0) {
      fail('rust', 'ErrorCode has no variants in the protocol crate')
    }
    else {
      for (const code of expected) {
        if (!actual.includes(code))
          fail('error-codes', `ErrorCode is missing ${code}`)
      }
      for (const code of actual) {
        if (!expected.includes(code)) {
          fail('error-codes', `ErrorCode has ${code}, which the Rust crate does not`)
        }
      }
      evidence.push(`${String(expected.length)} error codes compared`)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3 · 帧类型
  // ─────────────────────────────────────────────────────────────────────────────

  if (rustSource !== null) {
    const frameSource = read(join(PROTOCOL_CRATE, 'frame.rs'))
    const declaration = /pub enum FrameKind\s*\{([\s\S]*?)\n\}/.exec(frameSource)
    const body = declaration?.[1]
    if (body === undefined) {
      fail('rust', 'FrameKind was not found in frame.rs')
    }
    else {
      const rustKinds = [...body.matchAll(/^\s{4}([A-Z][A-Za-z0-9]*) = (0x[0-9a-fA-F]+),/gm)].map(
        match => ({ name: match[1] ?? '', value: Number.parseInt(match[2] ?? '0', 16) }),
      )
      for (const kind of rustKinds) {
        const inTs = new RegExp(`${kind.name}: (0x[0-9a-fA-F]+)`).exec(wire)
        const raw = inTs?.[1]
        if (raw === undefined) {
          fail('frame-kinds', `FrameKind.${kind.name} is not in wire.ts`)
          continue
        }
        const tsValue = Number.parseInt(raw, 16)
        if (tsValue !== kind.value) {
          fail(
            'frame-kinds',
            `FrameKind.${kind.name} is 0x${tsValue.toString(16)} in TS and 0x${kind.value.toString(16)} in Rust`,
          )
        }
      }
      evidence.push(`${String(rustKinds.length)} frame kinds compared`)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4 · 常量
  // ─────────────────────────────────────────────────────────────────────────────

  if (rustSource !== null) {
    const limitsSource = read(join(PROTOCOL_CRATE, 'limits.rs'))

    /** The constant's name and what both sides are expected to say. */
    const numeric: ReadonlyArray<readonly [string, number]> = [
      ['FRAME_HEADER_LEN', 6],
      ['MAX_FRAME_LEN', 1024 * 1024],
      ['MAX_CHUNK_LEN', 256 * 1024],
      ['MAX_PAYLOAD_LEN', 256 * 1024],
      ['DEFAULT_TCP_PORT', 32100],
      ['DISCOVERY_PORT', 32101],
    ]

    for (const [name, expected] of numeric) {
      if (!new RegExp(`pub const ${name}\\b`).test(limitsSource)) {
        fail('constants', `${name} is not in the protocol crate's limits`)
      }
      const inTs = new RegExp(`${name} = ([0-9*\\s]+)`).exec(wire)
      const raw = inTs?.[1]
      if (raw === undefined) {
        fail('constants', `${name} is not in wire.ts`)
        continue
      }
      const tsValue = evaluateProduct(raw)
      if (tsValue !== expected) {
        fail('constants', `${name} is ${String(tsValue)} in TS and ${String(expected)} was expected`)
      }
    }

    const mdns = /pub const MDNS_SERVICE: &str = "([^"]+)"/.exec(limitsSource)
    const mdnsTs = /MDNS_SERVICE = '([^']+)'/.exec(wire)
    if (mdns?.[1] === undefined || mdnsTs?.[1] === undefined) {
      fail('constants', 'MDNS_SERVICE is missing from one of the two sides')
    }
    else if (mdns[1] !== mdnsTs[1]) {
      fail('constants', `MDNS_SERVICE is ${mdnsTs[1]} in TS and ${mdns[1]} in Rust`)
    }
    evidence.push(`${String(numeric.length + 1)} constants compared`)
  }
}
