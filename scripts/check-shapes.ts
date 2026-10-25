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

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { pairingShapeProblems } from './pairing-shapes'

const here = dirname(fileURLToPath(import.meta.url))
const jsRoot = resolve(here, '..')

/** 内核仓库的目录名。 */
const KERNEL_DIRECTORY = 'synra-rust-core'

/**
 * 去哪儿找内核 checkout，按优先级排列。
 *
 * # 为什么要"找"而不是写死一个路径
 *
 * 与 Rust 的那些对照是**看起来通过了、其实什么都没查**的检查：找不到内核时每一项对照都被跳过，
 * 只留下一行 warning（见下面 `rustSource === null` 那个分支）。于是一次绿色的运行和一次从未对照过的
 * 运行，在摘要里长得一样。
 *
 * ★ **这一点已经漏过一次。** 本地布局是"内核在仓库**旁边**"（`../synra-rust-core`），
 * 而 `actions/checkout` 只能把文件放进工作区**里面**——放到工作区之外会被拒绝——于是 CI 把内核放在
 * `<仓库>/synra-rust-core`，而这里一直只找旁边那一个。**那段对照在 CI 里从未跑过。**
 *
 * 纯函数，便于测试（见 `check-shapes.test.ts`）：它决定的事——去哪儿找——错了不会报错，
 * 只会让检查静默地少做。
 */
export function kernelCandidates(root: string, coreRoot: string | undefined): string[] {
  return [coreRoot, join(root, '..', KERNEL_DIRECTORY), join(root, KERNEL_DIRECTORY)].filter(
    (candidate): candidate is string => candidate !== undefined && candidate !== '',
  )
}

/** 本次运行实际用的内核目录；一个都找不到时给一个用于报错的路径。 */
const kernelRoot
  = kernelCandidates(jsRoot, process.env.SYNRA_CORE_ROOT).find(candidate => existsSync(candidate))
    ?? join(jsRoot, '..', KERNEL_DIRECTORY)

const PROTOCOL_CRATE = join(kernelRoot, 'crates', 'synra-protocol', 'src')
const DTO_CRATE = join(kernelRoot, 'crates', 'synra-ipc', 'src', 'dto')
// ★ 指标快照不住在 `synra-ipc` 里，`diag_metrics` 把 `synra-observe` 的记录器快照原样过线。不加这一行，
// `ui.ts` 里那几个 interface 会被报成"没有同名 Rust struct" —— 那项报告本身是证据而不是失败，但一个
// 每次都出现的假缺口会让真正的缺口混在里面。
const METRICS_CRATE = join(kernelRoot, 'crates', 'synra-observe', 'src', 'metrics')

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
  PairingPhase: 'camelCase',
  PairingSnapshot: 'camelCase',
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
export function rustConvention(source: string, typeName: string): string | null {
  const declaration = new RegExp(`pub (?:struct|enum) ${typeName}\\b`).exec(source)
  if (declaration === null)
    return null
  const before = source.slice(Math.max(0, declaration.index - 4_000), declaration.index)
  const matches = [...before.matchAll(/#\[serde\([^)]*rename_all = "([a-zA-Z_-]+)"/g)]
  // ★ A convention belongs to this type only if no other type is declared between it and this one.
  //
  // The first version took the nearest preceding match, on the reasoning that it sits adjacent to the declaration. That
  // holds when a type has a convention, and fails when it does not: the previous type's is then the nearest one, and it is
  // read as this type's. The caller's "this type has no `rename_all`" failure was therefore unreachable in that case, so
  // the guard could report a convention the type does not have — and, worse, call it agreement when the neighbour's
  // happened to match the table. A test written to pin this behaviour is what found it.
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index]
    if (match === undefined) {
      continue
    }
    const after = before.slice((match.index ?? 0) + match[0].length)
    if (!/pub (?:struct|enum)\s/.test(after)) {
      return match[1] ?? null
    }
  }
  return null
}

/** TS 侧 `ErrorCode` 的取值。 */
export function tsErrorCodes(wire: string): string[] {
  const start = wire.indexOf('export type ErrorCode =')
  if (start < 0)
    return []
  const end = wire.indexOf('\n\n', start)
  const block = wire.slice(start, end < 0 ? undefined : end)
  return [...block.matchAll(/'([a-z_]+)'/g)].flatMap(match =>
    match[1] === undefined ? [] : [match[1]],
  )
}

/** Rust 侧 `ErrorCode` 的变体，转成 `snake_case`。 */
export function rustErrorCodes(source: string): string[] {
  const declaration = /pub enum ErrorCode\s*\{([\s\S]*?)\n\}/.exec(source)
  const body = declaration?.[1]
  if (body === undefined)
    return []
  const names = [...body.matchAll(/^\s{4}([A-Z][A-Za-z0-9]*),/gm)].flatMap(match =>
    match[1] === undefined ? [] : [match[1]],
  )
  return names.map(name =>
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
export function evaluateProduct(expression: string): number {
  let total = 1
  for (const factor of expression.split('*')) {
    const digits = factor.trim()
    if (!/^\d+$/.test(digits))
      return Number.NaN
    total *= Number.parseInt(digits, 10)
  }
  return total
}

const wirePath = join(jsRoot, 'packages', 'protocol', 'src', 'generated', 'wire.ts')
const wire = read(wirePath)

const rustFiles = existsSync(PROTOCOL_CRATE)
  ? readdirSync(PROTOCOL_CRATE).filter(name => name.endsWith('.rs'))
  : []

const rustSource
  = rustFiles.length > 0
    ? rustFiles.map(name => read(join(PROTOCOL_CRATE, name))).join('\n')
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

// ─────────────────────────────────────────────────────────────────────────────
// 5 · 界面 DTO 镜像与内核的对应关系
// ─────────────────────────────────────────────────────────────────────────────
//
// ★ 这一项是被换掉的，不是新增的。原来这里断言的是 `generated/` 下每个文件都有"自动生成，请勿手动
// 修改"的头注释。那个断言保护的是一个**不成立的说法**：生成物确实是手写的，生成它们的
// `gen-protocol-types.ts` 去跑 `cargo test -p synra-protocol --features ts-export`，而 synra-protocol
// 既没有 `[features]` 段也没有 `ts_export` 模块 —— 那条命令跑不起来。
//
// 一条"文件必须声称自己是被生成的"检查，防的不是漂移，防的是有人去查。而这里真正的失效恰恰是静默的：
// Rust 里改了字段名，TS 侧收到 `undefined`，表现是面板空白而不是编译错误。所以下面这一项检查的是
// **内容对不对**，不是**声称对不对**。

{
  const protocolDirectory = PROTOCOL_CRATE
  const dtoDirectory = DTO_CRATE
  const generatedDir = join(jsRoot, 'packages', 'protocol', 'src', 'generated')

  if (!existsSync(dtoDirectory)) {
    evidence.push('dto-coverage: 内核仓库不在旁边，所以镜像没有对照')
  }
  else {
    /** `synra-ipc` 的 DTO，字段，键是 struct 名。正向检查只看这一份。 */
    const dtoFields = new Map<string, string[]>()
    /** 三个目录合起来的 struct，键是 struct 名。反向检查用这一份。 */
    const rustFields = new Map<string, string[]>()
    /**
     * 三个 Rust 目录都要扫。
     *
     * `ui.ts` 照的是 `synra-ipc` 的 DTO，而 `wire.ts` / `events.ts` 照的是 `synra-protocol` 的线协议类型；
     * `ui.ts` 里的指标快照又来自 `synra-observe` 的 `metrics`。只扫第一个会把后两个文件里每一个 interface
     * 都报成"内核里没有同名 DTO" —— 于是检查第一次跑就红，而一个一直红的检查等于没有检查。
     */
    const rustRoots = [dtoDirectory, protocolDirectory, METRICS_CRATE]
    for (const root of rustRoots) {
      if (!existsSync(root)) {
        continue
      }
      /** 该目录下的 `.rs`，递归。 */
      const rustFiles: string[] = []
      const walk = (directory: string): void => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
          const full = join(directory, entry.name)
          if (entry.isDirectory()) {
            walk(full)
          }
          else if (entry.name.endsWith('.rs')) {
            rustFiles.push(full)
          }
        }
      }
      walk(root)

      for (const file of rustFiles) {
        const body = read(file)
        for (const match of body.matchAll(/pub struct (\w+)\s*\{([^}]*)\}/g)) {
          const structName = match[1]
          const inner = match[2]
          if (structName === undefined || inner === undefined)
            continue
          const fields = [...inner.matchAll(/^\s*pub (\w+):/gm)].map(f => f[1]).filter(f => f !== undefined)
          rustFields.set(structName, fields)
          if (root === dtoDirectory) {
            dtoFields.set(structName, fields)
          }
        }
      }
    }

    /** TypeScript interface 的字段，键是 interface 名。 */
    const tsFields = new Map<string, string[]>()
    for (const name of readdirSync(generatedDir).filter(n => n.endsWith('.ts'))) {
      const body = read(join(generatedDir, name))
      for (const match of body.matchAll(/export interface (\w+)\s*\{([^}]*)\}/g)) {
        const iface = match[1]
        const inner = match[2]
        if (iface === undefined || inner === undefined)
          continue
        tsFields.set(
          iface,
          [...inner.matchAll(/readonly (\w+)\??:/g)].map(f => f[1]).filter(f => f !== undefined),
        )
      }
    }

    // 两个方向都要查。只查一个方向的检查，删掉东西也能过：少一个 interface 和多一个 interface 一样让它变绿。
    if (rustFields.size === 0) {
      fail('dto-coverage', `${dtoDirectory} 下没有找到 DTO struct —— 解析可能已经不再适用`)
    }
    if (tsFields.size === 0) {
      fail('dto-coverage', `${generatedDir} 下没有找到 interface —— 解析可能已经不再适用`)
    }

    /**
     * 正向只对 `synra-ipc` 的 DTO 查。
     *
     * DTO 按定义就是边界上的东西，所以"内核有一个 DTO 而界面没有"一定是漏了。
     * `synra-protocol` 不能这样查：它同时有 `CoalesceBuffer`、`HandshakeBudget`、`TransferWindow` 这类
     * 纯内部的类型，它们**不打算**上线。让每个协议 struct 都得有一个 interface，于是第一次跑就红，
     * 而一个一直红的检查等于没有检查。
     */
    for (const [name, fields] of dtoFields) {
      const mirrored = tsFields.get(name)
      if (mirrored === undefined) {
        fail('dto-coverage', `${name} 在内核里声明了，ui.ts 里没有对应的 interface`)
        continue
      }
      // Rust 是 snake_case，TS 是 camelCase，所以比的是转换过的名字 —— 这才能发现**改名**，而不只是发现
      // 整个结构体不见了。两边都小写会把 `device_id` 和 `deviceId` 判成不等，于是每个字段都报缺失，
      // 而一个每次都报的检查是没人会看的检查，也就不是检查。
      const mirroredNames = new Set(mirrored.map(f => f.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`)))
      const missing = fields.filter(f => !mirroredNames.has(f))
      if (missing.length > 0) {
        fail('dto-coverage', `${name} 在 Rust 里声明了 ${missing.join(', ')}，ui.ts 里没有`)
      }
    }

    /**
     * 反向对**两个** crate 一起查，但报成证据而不是失败。
     *
     * `events.ts` 里确实有几条 TS 侧的组合类型（比如事件信封），内核里没有同名 struct，因为它们不是
     * 线协议上的东西而是界面自己封的。把它们当失败，那么唯一的"修法"就是删掉一个真正在用的类型 ——
     * 而那正是这项检查最不该鼓励的动作。所以这里列出来，让人看一眼，而不是让 CI 变红。
     */
    const unbacked = [...tsFields.keys()].filter(name => !rustFields.has(name))
    if (unbacked.length > 0) {
      evidence.push(
        `dto-coverage: ${String(unbacked.length)} 个 TS interface 没有同名 Rust struct（界面侧的组合类型）：${
          unbacked.join(', ')}`,
      )
    }

    const agreed = [...dtoFields.keys()].filter(n => tsFields.has(n)).length
    evidence.push(
      `dto-coverage: Rust ${String(dtoFields.size)} 个 DTO 逐字段对照，${String(agreed)} 个对得上；`
      + `ui.ts 共 ${String(tsFields.size)} 个 interface`,
    )
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
    if (entry.import !== undefined || entry.require !== undefined) {
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
    if (entry.types === undefined) {
      // ★ 这句话原先写反了。条件问的是"`types` **缺了**吗"，而消息说的是
      //   "一个纯类型包**不得**声明 `exports["."].types`" —— 两者意思相反。
      //   一份失败信息如果把人指向"删掉这个字段"，而真正该做的是"加上它"，
      //   那比不说还糟：照着做会把包改得更坏，而且看起来像是照着报错做的。
      fail(
        `packages/${name}`,
        'a type-only package must declare `exports["."].types`: it is the only way in',
      )
    }

    // ★ 声明的入口和"没有 `.js`"都还不够：一个纯类型包**可以**在入口导出值。
    //
    //   `export const x = 1` 配上 `emitDeclarationOnly`，源码能编译，产出的是
    //   `export declare const x: number` —— 于是声明文件向消费方承诺了一个运行时**并不存在**的值。
    //   类型检查会通过，打包器会去找一个没有的东西，而"零运行时"这句话就变成了假的。
    //
    // ★ 检查的是**入口**（`dist/index.d.ts`），不是整个 `dist`。
    //
    //   消费方只能通过 `exports` 指的那个文件到达这个包。内部模块里有一个值，而入口只用
    //   `export type` 把类型带出来，那这个值对消费方**不存在**，也就不构成破坏 ——
    //   而按整个 dist 去查会把这种无害的情况也判成失败，逼着人把内部实现挪走或加白名单。
    //   判据是入口里的 `export { ... }`（不带 `type`）：仓库开了 `verbatimModuleSyntax`，
    //   所以"这个导出是类型还是值"由编译器强制区分，不是靠自觉。
    const dist = join(jsRoot, 'packages', name, 'dist')
    if (existsSync(dist)) {
      const stray = readdirSync(dist, { recursive: true })
        .map(String)
        .filter(entry_ => entry_.endsWith('.js') || entry_.endsWith('.mjs'))
      if (stray.length > 0) {
        fail(
          `packages/${name}/dist`,
          `a type-only package emitted runtime files: ${stray.join(', ')}`,
        )
      }

      const entryFile = join(dist, 'index.d.ts')
      if (existsSync(entryFile)) {
        const valueExports = [...read(entryFile).matchAll(/^export\s*\{([^}]*)\}/gm)].flatMap(
          match =>
            (match[1] ?? '')
              .split(',')
              .map(part => part.trim())
              .filter(part => part.length > 0),
        )
        if (valueExports.length > 0) {
          fail(
            `packages/${name}/dist/index.d.ts`,
            `a type-only package exports values with no runtime behind them: ${valueExports.join(', ')}`,
          )
        }
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
      'index.ts does not `import \'./global\'`, so `types: ["@synra/client"]` would not pull in the global declarations',
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
    if (!existsSync(directory))
      continue
    for (const file of readdirSync(directory)) {
      if (!file.endsWith('.ts'))
        continue
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
// 9 · 四个可发布包的版本一致
// ─────────────────────────────────────────────────────────────────────────────

{
  // ★ 为什么这值得一条守卫，而不是靠 `bumpp -r` 记得跑。
  //
  //   包之间用的是 `workspace:^`，发布时 pnpm 把它改写成 `^<当前版本>`。所以一旦版本错开 ——
  //   `synra` 到了 0.2.0 而 `@synra/client` 还在 0.1.0 —— `@synra/client` 发布出去的依赖就写着
  //   `synra@^0.1.0`，作者装到的是**另一个版本**的 facade，而两边的类型是按同一版设计的。
  //   症状是全局 `synra` 的类型与实际注入的对象对不上，而没有任何地方会因此报错。
  //
  //   设计文档 §4.1 说的是"三个包同步版本"，而仓库里可发布的是**四个**（`testkit` 也是）：
  //   它的数量也一并更正了 —— 一条只守三个包的守卫会漏掉第四个。
  // ★ 名字从 `publishable` 改成 `versionSynced`：可发布的是**五个**，而共用一条版本线的是**四个**。
  //   把 `@synra/theme` 也加进这个数组会让人以为它属于这条线 —— 而它在设计上是独立的
  //   （`25 §4.1` 的 ★：它不 re-export 上面的包，也不被它们依赖，所以没有需要对代的代次）。
  const versionSynced = ['client', 'protocol', 'synra', 'testkit'] as const
  const versions = versionSynced.map((name) => {
    const manifest = JSON.parse(read(join(jsRoot, 'packages', name, 'package.json'))) as {
      readonly version?: string
    }
    return { name, version: manifest.version ?? '(no version)' }
  })
  const distinct = new Set(versions.map(entry => entry.version))
  if (distinct.size > 1) {
    fail(
      'version-sync',
      `the publishable packages disagree on a version: ${versions
        .map(entry => `${entry.name}@${entry.version}`)
        .join(', ')}`,
    )
  }
  const [first] = versions
  evidence.push(
    `${String(versions.length)} publishable packages share version ${first?.version ?? '(none)'}`,
  )

  // ★ 而 `@synra/theme` 也要进 registry，所以要有人管它的 `publishConfig` —— 但它**不在这条线上**。
  //   这条守卫只回答"它准备好被发布了没有"，不回答"它的版本号是多少"：后者由发布时的标签守卫管
  //   （`scripts/check-release-tag.ts`，见 `25 §6.1`）。
  const theme = JSON.parse(read(join(jsRoot, 'packages', 'theme', 'package.json'))) as {
    readonly version?: string
    readonly publishConfig?: { readonly access?: string }
  }
  if (theme.publishConfig?.access !== 'public') {
    fail(
      'version-sync',
      'packages/theme 是要发布的包，所以 publishConfig.access 必须是 public（scoped 包默认是 private）',
    )
  }
  evidence.push(`@synra/theme@${theme.version ?? '(none)'} 独立一条版本线，与那四个无关`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 9 · `@synra/theme` 的包根零依赖，而每个外部依赖只在它自己那一层
// ─────────────────────────────────────────────────────────────────────────────
//
// ★ 这两条是"分层"这个设计的**承重墙**，它们是同一个决定的两种失败方式：
//
//   - **包根依赖某个外部 UI（9）**：官网为一个它不用的工具付一次装包与体积 —— 官网只要颜色，
//     而颜色从包根取（`./css` 与 `./vitepress` 也都不碰它们）。
//   - **那个 import 散落到别的子路径（10）**：那时"子路径"名存实亡，
//     消费者看到的仍然是一个必须装它的包，而分离只存在于目录结构上。
//
// 一条管"谁被拖累"，一条管"分离是不是真的"。
//
// ★ **2026-10-16：这条规则从"跑一遍"变成"跑两遍"。** 业主定下宿主用 antd 之后，
//   `@synra/theme` 多了 `./antd` 子路径（[28 R51–R53]），而 `ant-design-vue` 与 `unocss`
//   是完全同一种形状：一个只属于某一个子路径的外部依赖，大到不该让所有人付。
//   判据一个字没改，改的只是下面那张表 —— 而**加第三个外部 UI 时也只需要加一行**。

{
  const themeDirectory = join(jsRoot, 'packages', 'theme')
  const manifest = JSON.parse(read(join(themeDirectory, 'package.json'))) as {
    readonly name?: string
    readonly dependencies?: Record<string, string>
    readonly peerDependencies?: Record<string, string>
    readonly peerDependenciesMeta?: Record<string, { readonly optional?: boolean }>
  }

  if (manifest.name !== '@synra/theme') {
    fail('theme-root', `packages/theme 的 name 是 ${manifest.name ?? '(none)'}，而不是 @synra/theme`)
  }

  if (manifest.dependencies !== undefined && Object.keys(manifest.dependencies).length > 0) {
    fail(
      'theme-root',
      `包根必须零依赖，而它声明了：${Object.keys(manifest.dependencies).join(', ')}`,
    )
  }
  // ★ **同一条规则跑两遍**（R52）：每个"只属于某一层"的外部依赖，检查方式完全一样。
  //   第三个外部 UI 进来时，这里只加一行 —— 而不是加一套守卫。
  const externalLayers = [
    { dependency: 'unocss', directory: 'src/unocss', consumer: './unocss' },
    { dependency: 'ant-design-vue', directory: 'src/antd', consumer: './antd' },
  ] as const

  // 入口的声明里不该出现任何一个这样的依赖。查 `dist` 是因为发布出去的就是它；没构建时跳过并说明。
  const themeEntry = join(themeDirectory, 'dist', 'index.d.ts')
  const entrySource = existsSync(themeEntry) ? read(themeEntry) : null

  for (const layer of externalLayers) {
    if (manifest.peerDependencies?.[layer.dependency] === undefined) {
      fail(
        'theme-root',
        `${layer.dependency} 必须是 peerDependency：包根不用它，而 ${layer.consumer} 那一层要用`,
      )
    }
    if (manifest.peerDependenciesMeta?.[layer.dependency]?.optional !== true) {
      fail(
        'theme-root',
        `${layer.dependency} 必须在 peerDependenciesMeta 里标成 optional —— 否则每个不用它的消费者都要装它`,
      )
    }
    if (entrySource !== null && importsDependency(entrySource, layer.dependency)) {
      fail('theme-root', `entry 里出现了 ${layer.dependency} 的 import —— 包根本该零依赖`)
    }

    const offenders: string[] = []
    const walkTheme = (directory: string): void => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const full = join(directory, entry.name)
        if (entry.isDirectory()) {
          walkTheme(full)
          continue
        }
        if (!entry.name.endsWith('.ts')) {
          continue
        }
        const relative = full.slice(themeDirectory.length + 1).replaceAll('\\', '/')
        if (relative.startsWith(`${layer.directory}/`)) {
          continue
        }
        if (importsDependency(read(full), layer.dependency)) {
          offenders.push(relative)
        }
      }
    }
    walkTheme(join(themeDirectory, 'src'))
    if (offenders.length > 0) {
      fail(
        'theme-layers',
        `只有 ${layer.directory}/** 可以 import ${layer.dependency}，而这些文件也导入了：${offenders.join(', ')}`,
      )
    }
  }

  evidence.push('theme: 包根零依赖，两个 optional peer（unocss / ant-design-vue）各自只在它那一层')
}

/**
 * 这个文件里有没有 import 某个外部依赖。
 *
 * ★ **三种形态，第二种是负控制抓出来的**：`import … from '<dep>'`、**副作用导入** `import '<dep>'`、
 * 以及动态 `import('<dep>')`。第一版的模式是 `from 'unocss'`，于是 `import 'unocss'` 从它下面走过去了 ——
 * 而那个形态恰恰是最容易被顺手写下的一个。
 *
 * ★ 而且模式不许"跑远"：`[^;]*?` 把匹配限制在**一条语句内**，所以多行 import 能命中，
 * 而"文件开头有个 import、文件末尾有个字符串 '<dep>'"不会被当成同一件事
 * （`synra-app` 的 `check-shapes` 里记着这个教训的另一种形态）。
 *
 * ★ 2026-10-16：依赖名成了参数（`ant-design-vue` 是第二个），所以名字里的 `-` / `.` 要转义 ——
 * 否则 `ant-design-vue` 会被当成一个字符类，而那是一条永远为真的模式。
 */
function importsDependency(source: string, dependency: string): boolean {
  // 先去掉行注释，否则一句"不要 import 'unocss'"的注释会把守卫骗红。
  const code = source.replace(/\/\/[^\n]*/g, '')
  const name = dependency.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  return new RegExp(`(?:^|\\n)[ \\t]*(?:import|export)\\b[^;]*?['"]${name}['"]`).test(code)
    || new RegExp(`\\bimport\\s*\\(\\s*['"]${name}['"]`).test(code)
}

// ─────────────────────────────────────────────────────────────────────────────
// 12 · 每个声明的入口都真的存在
// ─────────────────────────────────────────────────────────────────────────────
//
// ★ **这一条是"发布之后才会发现"的守门的定价**。`@synra/testkit` 的 `main` / `module` /
//   `exports.import` 三处都写着 `./dist/index.mjs`，而 `tsc -b` 产出的是 `dist/index.js` ——
//   于是它的运行期入口指向一个**不存在的文件**。
//
//   为什么没有任何东西发现它：`types` 是对的，所以**类型检查全绿**；而这个包不在
//   `scripts/link-dist.ts` 的名单里（那份名单只给"纯类型包"铺安装布局）。失败落在
//   使用者的第一次 `import`，而那已经是我们发出去之后了。
//
//   判据是"声明的路径必须存在"，不是"扩展名必须是什么" —— 后者会把 `.mjs` / `.cjs` 这类
//   合法的选择也判成错。

{
  const publishable = ['client', 'protocol', 'synra', 'testkit', 'theme'] as const
  const missing: string[] = []
  let checked = 0

  for (const name of publishable) {
    const directory = join(jsRoot, 'packages', name)
    // 没有构建产物时跳过（并在下面说明）：`check` 会先跑 `tsc -b`，所以正常路径下 dist 都在。
    if (!existsSync(join(directory, 'dist'))) {
      continue
    }
    checked += 1

    const manifest = JSON.parse(read(join(directory, 'package.json'))) as {
      readonly name?: string
      readonly main?: string
      readonly module?: string
      readonly types?: string
      readonly exports?: Record<string, string | Record<string, string>>
    }

    const declared: string[] = []
    for (const field of [manifest.main, manifest.module, manifest.types]) {
      if (field !== undefined) {
        declared.push(field)
      }
    }
    for (const entry of Object.values(manifest.exports ?? {})) {
      if (typeof entry === 'string') {
        declared.push(entry)
        continue
      }
      for (const path of Object.values(entry)) {
        declared.push(path)
      }
    }

    for (const path of declared) {
      if (!existsSync(join(directory, path))) {
        missing.push(`${manifest.name ?? name} 的 ${path}`)
      }
    }
  }

  if (missing.length > 0) {
    fail(
      'entry-paths',
      `这些声明的入口文件不存在（消费者第一次 import 时才会发现）：${missing.join('、')}`,
    )
  }
  evidence.push(`每个声明的入口都指向真实文件（查了 ${String(checked)} 个包）`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 13 · 每个包都带协议文本，而且与根上的那份逐字节相同
// ─────────────────────────────────────────────────────────────────────────────
//
// ★ 五处 `package.json` 都写着 `license: MIT`，而仓库里**一个 LICENSE 文件都没有** ——
//   于是发布出去的包里有那个字段、没有那段文本。npm 会**自动包含包目录下的** `LICENSE`
//   （不受 `files` 白名单影响），但它不会去仓库根拿。
//
//   五份拷贝是 npm 的形态决定的（它不认"根上一份、子包引用"），所以它们会漂移 ——
//   除非有人盯着。这一条就是那个"盯着"：任何一份与根上那份不同即失败。

{
  const rootLicense = join(jsRoot, 'LICENSE')
  if (!existsSync(rootLicense)) {
    fail('license', '仓库根缺少 LICENSE：五个包都声明了 license 字段，而发布物里该有那段文本')
  }
  else {
    const expected = read(rootLicense)
    const drifted: string[] = []
    for (const name of ['client', 'protocol', 'synra', 'testkit', 'theme'] as const) {
      const copy = join(jsRoot, 'packages', name, 'LICENSE')
      if (!existsSync(copy)) {
        drifted.push(`${name} 没有 LICENSE`)
      }
      else if (read(copy) !== expected) {
        drifted.push(`${name} 的 LICENSE 与根上的不一致`)
      }
    }
    if (drifted.length > 0) {
      fail('license', `${drifted.join('、')}（五份拷贝是 npm 的形态决定的，所以它们必须一起改）`)
    }
    evidence.push('五个包都带着与根上逐字节相同的 LICENSE')
  }
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
