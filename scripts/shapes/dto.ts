import type { ShapeContext } from './context'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { dtoOptionalityProblems } from '../dto-optionality'

export function checkDtos(context: ShapeContext): void {
  const { jsRoot, protocolDirectory: PROTOCOL_CRATE, dtoDirectory: DTO_CRATE, metricsDirectory: METRICS_CRATE, read, fail, evidence } = context
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
      const serializedDtos: string[] = []
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
          if (root === dtoDirectory)
            serializedDtos.push(body)
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
      const mirror: string[] = []
      const tsFields = new Map<string, string[]>()
      for (const name of readdirSync(generatedDir).filter(n => n.endsWith('.ts'))) {
        const body = read(join(generatedDir, name))
        mirror.push(body)
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
          fail('dto-coverage', `${name} 在内核里声明了，TypeScript 镜像里没有对应的 interface`)
          continue
        }
        // Rust 是 snake_case，TS 是 camelCase，所以比的是转换过的名字 —— 这才能发现**改名**，而不只是发现
        // 整个结构体不见了。两边都小写会把 `device_id` 和 `deviceId` 判成不等，于是每个字段都报缺失，
        // 而一个每次都报的检查是没人会看的检查，也就不是检查。
        const mirroredNames = new Set(mirrored.map(f => f.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`)))
        const missing = fields.filter(f => !mirroredNames.has(f))
        if (missing.length > 0) {
          fail('dto-coverage', `${name} 在 Rust 里声明了 ${missing.join(', ')}，TypeScript 镜像里没有`)
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

      for (const problem of dtoOptionalityProblems(serializedDtos.join('\n'), mirror.join('\n')))
        fail('dto-optionality', problem)
      evidence.push('DTO fields omitted by serde are optional in TypeScript')

      const agreed = [...dtoFields.keys()].filter(n => tsFields.has(n)).length
      evidence.push(
        `dto-coverage: Rust ${String(dtoFields.size)} 个 DTO 逐字段对照，${String(agreed)} 个对得上；`
        + `TypeScript 镜像共 ${String(tsFields.size)} 个 interface`,
      )
    }
  }
}
