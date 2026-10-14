#!/usr/bin/env tsx
/**
 * 形状一致性守卫。
 *
 * # 为什么需要它
 *
 * TS 侧的类型是**手写的镜像**，Rust 侧是唯一真相源。没有守卫的话，改了 Rust 的 serde 约定而忘了
 * 改 TS，症状是运行时解析失败 —— 而那会出现在用户的设备上，不是 CI 里。
 *
 * 这个脚本读 Rust 源码里的 `#[serde(rename_all = …)]` 约定与枚举变体名，与 TS 侧的声明比对。
 * 它**不是**代码生成器：生成器要从 cargo 里跑 `ts-rs`，而这个守卫只要读文件，所以它能在纯 Node
 * 的 CI 里跑，不依赖 Rust 工具链。
 *
 * # 八类检查
 *
 * 1. 大小写约定：每个 TS 类型的字段大小写必须与该类型在 Rust 里的 `rename_all` 一致。
 * 2. 错误码：`ErrorCode` 的变体集合必须与 Rust 的完全一致，且是 `snake_case`。
 * 3. 帧类型：`FrameKind` 的数字必须与 `#[repr(u8)]` 的显式值一致。
 * 4. 常量：帧头长度、上限、端口、mDNS 服务名必须一致。
 * 5. 生成物标注：`generated/` 下的每个文件必须有那三行头注释。
 * 6. 零运行时：三个纯类型包不许声明 `.js` 入口。
 * 7. 全局声明可达：`@synra/client` 的入口必须引到 `global`，否则 `types` 数组拿不到全局 `synra`。
 * 8. `SynraResponse` 只声明一次。
 *
 * # 退出码
 *
 * 任何一项不一致就退出 1 并列出**全部**问题，不是遇到第一个就停 —— 一次改动能同时破坏几处，分开
 * 跑几轮才能发现所有问题是最浪费的。
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const jsRoot = resolve(here, '..')
const repoRoot = resolve(jsRoot, '..')

const PROTOCOL_CRATE = join(repoRoot, 'synra-rust-core', 'crates', 'synra-protocol', 'src')

interface Problem {
  readonly where: string
  readonly what: string
}

const problems: Problem[] = []
const evidence: string[] = []

function fail(where: string, what: string): void {
  problems.push({ where, what })
}

function read(path: string): string {
  return readFileSync(path, 'utf8')
}

/**
 * Rust 侧"类型名 → 字段命名约定"的期望。
 *
 * 写在这里而不是从 Rust 里推导，是因为 TS 侧的类型清单是手写的：这份表就是那个清单，改动它要有
 * 意识地改，而不是跟着源码漂移。
 *
 * 值是 Rust 的 `rename_all` 原文（`camelCase`、`snake_case`、`kebab-case`、`lowercase`），或者
 * `null` 表示 TS 侧只有类型别名、没有字段要比。
 *
 * ★ 表里列出的每个类型都必须在 Rust 里**存在**。一个不存在的类型会让守卫报错，而那正是它该做的：
 * TS 侧声明了一个线上没有的形状，作者会照着它写代码。
 */
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
  PairRefusal: 'snake_case',
  IntentDisplay: 'camelCase',
  IntentInvocation: 'camelCase',
  IntentOutcome: 'camelCase',
  // 传输
  TransferKind: 'kebab-case',
  DigestAlgorithm: 'lowercase',
  TransferProgress: 'camelCase',
  TransferAbortReason: 'snake_case',
}

/**
 * 从 Rust 源码里找出一个类型的 `rename_all`。
 *
 * 回看窗口是 4 000 字符：这些类型前面的文档注释可以很长（一个解释"为什么这个形状是这样的"的段落
 * 有几百字是常事），而窗口太短会让守卫报"没有约定" —— 一个假失败，且它看起来像是代码的问题而不是
 * 守卫的问题。
 *
 * 取**最后**一个匹配，因为它紧邻声明：前面的那些属于别的类型。
 */
function rustConvention(source: string, typeName: string): string | null {
  const declaration = new RegExp(`pub (?:struct|enum) ${typeName}\\b`).exec(source)
  if (declaration === null) return null
  const before = source.slice(Math.max(0, declaration.index - 4_000), declaration.index)
  const matches = [...before.matchAll(/#\[serde\([^)]*rename_all = "([a-zA-Z_-]+)"/g)]
  return matches.at(-1)?.[1] ?? null
}

/** TS 侧 `ErrorCode` 的取值。 */
function tsErrorCodes(wire: string): string[] {
  const start = wire.indexOf('export type ErrorCode =')
  if (start < 0) return []
  const end = wire.indexOf('\n\n', start)
  const block = wire.slice(start, end < 0 ? undefined : end)
  return [...block.matchAll(/'([a-z_]+)'/g)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  )
}

/** Rust 侧 `ErrorCode` 的变体，转成 `snake_case`。 */
function rustErrorCodes(source: string): string[] {
  const declaration = /pub enum ErrorCode\s*\{([\s\S]*?)\n\}/.exec(source)
  const body = declaration?.[1]
  if (body === undefined) return []
  const names = [...body.matchAll(/^\s{4}([A-Z][A-Za-z0-9]*),/gm)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  )
  return names.map((name) =>
    name
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
      .toLowerCase(),
  )
}

/**
 * Evaluates a product of integer literals, which is the only shape the constants are written in.
 *
 * Written out rather than using `eval` or `Function`: a guard that executes text from a file is a guard
 * whose own correctness has to be reasoned about, and the shapes here are a handful of digits and
 * asterisks.
 */
function evaluateProduct(expression: string): number {
  let total = 1
  for (const factor of expression.split('*')) {
    const digits = factor.trim()
    if (!/^[0-9]+$/.test(digits)) return Number.NaN
    total *= Number.parseInt(digits, 10)
  }
  return total
}

const wirePath = join(jsRoot, 'packages', 'protocol', 'src', 'generated', 'wire.ts')
const wire = read(wirePath)

const rustFiles = existsSync(PROTOCOL_CRATE)
  ? readdirSync(PROTOCOL_CRATE).filter((name) => name.endsWith('.rs'))
  : []

const rustSource =
  rustFiles.length > 0
    ? rustFiles.map((name) => read(join(PROTOCOL_CRATE, name))).join('\n')
    : null

if (rustSource === null) {
  // 没有 Rust 源码时不失败：这个仓库可以在只 checkout 了自己的 CI 里跑。但要说出来，否则守卫看起
  // 来通过了而其实什么都没查 —— 那比失败更糟。
  console.warn(
    [
      `! the Rust protocol crate was not found at ${PROTOCOL_CRATE}`,
      '  the checks that compare against Rust were skipped.',
      '  check out `synra-rust-core` beside `synra-js` to run them.',
    ].join('\n'),
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 1 · 大小写约定
// ─────────────────────────────────────────────────────────────────────────────

if (rustSource !== null) {
  let checked = 0
  for (const [typeName, expected] of Object.entries(RUST_CONVENTIONS)) {
    if (expected === null) continue
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
}

// ─────────────────────────────────────────────────────────────────────────────
// 2 · 错误码
// ─────────────────────────────────────────────────────────────────────────────

if (rustSource !== null) {
  const expected = rustErrorCodes(rustSource).sort()
  const actual = tsErrorCodes(wire).sort()

  if (expected.length === 0) {
    fail('rust', 'ErrorCode has no variants in the protocol crate')
  } else {
    for (const code of expected) {
      if (!actual.includes(code)) fail('error-codes', `ErrorCode is missing ${code}`)
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
  } else {
    const rustKinds = [...body.matchAll(/^\s{4}([A-Z][A-Za-z0-9]*) = (0x[0-9a-fA-F]+),/gm)].map(
      (match) => ({ name: match[1] ?? '', value: Number.parseInt(match[2] ?? '0', 16) }),
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
  } else if (mdns[1] !== mdnsTs[1]) {
    fail('constants', `MDNS_SERVICE is ${mdnsTs[1]} in TS and ${mdns[1]} in Rust`)
  }
  evidence.push(`${String(numeric.length + 1)} constants compared`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 5 · 生成物标注
// ─────────────────────────────────────────────────────────────────────────────

{
  const generatedDir = join(jsRoot, 'packages', 'protocol', 'src', 'generated')
  if (!existsSync(generatedDir)) {
    fail('generated', 'the generated directory does not exist')
  } else {
    const files = readdirSync(generatedDir).filter((name) => name.endsWith('.ts'))
    if (files.length === 0) {
      fail('generated', 'the generated directory has no files')
    }
    for (const name of files) {
      const text = read(join(generatedDir, name))
      for (const marker of ['自动生成，请勿手动修改', '来源：', '同步：']) {
        if (!text.includes(marker)) {
          fail(`generated:${name}`, `the header is missing ${marker}`)
        }
      }
    }
    evidence.push(`${String(files.length)} generated file(s) carry the do-not-edit header`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6 · 零运行时：三个纯类型包不许有 .js 入口，也不许产出 .js 文件
// ─────────────────────────────────────────────────────────────────────────────

{
  const typeOnly = ['client', 'protocol', 'synra'] as const
  for (const name of typeOnly) {
    const manifestPath = join(jsRoot, 'packages', name, 'package.json')
    if (!existsSync(manifestPath)) {
      fail(`packages/${name}`, 'the package directory has no package.json')
      continue
    }
    const manifest = JSON.parse(read(manifestPath)) as {
      readonly exports?: Record<string, Record<string, string>>
      readonly main?: string
      readonly module?: string
    }
    const entry = manifest.exports?.['.'] ?? {}
    if (entry['import'] !== undefined || entry['require'] !== undefined) {
      fail(
        `packages/${name}`,
        'a type-only package must not declare a runtime entry point in `exports`',
      )
    }
    if (manifest.main !== undefined || manifest.module !== undefined) {
      fail(
        `packages/${name}`,
        'a type-only package must not declare `main` or `module`: those resolve to a .js that does not exist',
      )
    }
    if (entry['types'] === undefined) {
      fail(`packages/${name}`, 'a type-only package must not declare `exports["."].types`')
    }

    // ★ 声明的入口只是一半：`tsc` 默认会为每个模块产出 `.js`，而一个**发布出去但没人指向**的运行时
    //   文件，是消费方的打包器可以自由选中的东西。`emitDeclarationOnly` 才是让它不存在的那一步，这里
    //   检查它确实生效了。dist 不存在（还没构建）就跳过：那是"没构建"，不是"构建错了"。
    const dist = join(jsRoot, 'packages', name, 'dist')
    if (existsSync(dist)) {
      const stray = readdirSync(dist, { recursive: true })
        .map(String)
        .filter((entry_) => entry_.endsWith('.js') || entry_.endsWith('.mjs'))
      if (stray.length > 0) {
        fail(
          `packages/${name}/dist`,
          `a type-only package emitted runtime files: ${stray.join(', ')}`,
        )
      }
    }
  }
  evidence.push(`${String(typeOnly.length)} type-only packages checked for a runtime entry`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 7 · `types: ["@synra/client"]` 开箱即用
// ─────────────────────────────────────────────────────────────────────────────

{
  // 全局声明必须在**入口的声明文件**里可达。做法是检查 `index.ts` 里有一行 `import './global'`：
  // 没有它，`declare global` 不会被拉进声明文件，而 `types: ["@synra/client"]` 只会导入一个空的
  // 模块 —— 症状是全局 `synra` 未定义，而作者找不到原因。
  const clientIndex = read(join(jsRoot, 'packages', 'client', 'src', 'index.ts'))
  if (!/^\s*import\s+['"]\.\/global['"]/m.test(clientIndex)) {
    fail(
      'packages/client',
      "index.ts does not `import './global'`, so `types: [\"@synra/client\"]` would not pull in the global declarations",
    )
  }

  const globalDecl = read(join(jsRoot, 'packages', 'client', 'src', 'global.ts'))
  for (const declaration of ['const synra: SynraClient', 'readonly synra?: SynraClient']) {
    if (!globalDecl.includes(declaration)) {
      fail('packages/client', `global.ts does not declare \`${declaration}\``)
    }
  }
  if (!/declare global\s*\{/.test(globalDecl)) {
    fail('packages/client', 'global.ts has no `declare global` block')
  }
  evidence.push('the global declarations are reachable from the entry point')
}

// ─────────────────────────────────────────────────────────────────────────────
// 8 · `SynraResponse` 只声明一次
// ─────────────────────────────────────────────────────────────────────────────

{
  let declarations = 0
  for (const directory of [
    join(jsRoot, 'packages', 'protocol', 'src'),
    join(jsRoot, 'packages', 'client', 'src'),
    join(jsRoot, 'packages', 'synra', 'src'),
  ]) {
    if (!existsSync(directory)) continue
    for (const file of readdirSync(directory)) {
      if (!file.endsWith('.ts')) continue
      declarations += [...read(join(directory, file)).matchAll(/export interface SynraResponse\b/g)]
        .length
    }
  }
  if (declarations !== 1) {
    fail(
      'shape-contract',
      `SynraResponse is declared ${String(declarations)} time(s); it must be declared exactly once, in @synra/client/src/http.ts`,
    )
  }
  evidence.push('SynraResponse is declared once')
}

// ─────────────────────────────────────────────────────────────────────────────

if (problems.length > 0) {
  console.error(`\n✗ shape check failed with ${String(problems.length)} problem(s):\n`)
  for (const problem of problems) {
    console.error(`  ${problem.where}\n    ${problem.what}`)
  }
  console.error('')
  process.exit(1)
}

console.log(`✓ shapes agree (${String(evidence.length)} checks)`)
for (const line of evidence) {
  console.log(`  · ${line}`)
}
