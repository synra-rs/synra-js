#!/usr/bin/env tsx
/**
 * 核对协议类型镜像与内核，**不再生成**。
 *
 * # 这个脚本以前做什么，以及为什么停下了
 *
 * 它以前跑 `cargo test -p synra-protocol --features ts-export`，把导出的 `.ts` 复制到
 * `packages/protocol/src/generated/`，再给每个文件加上"请勿手改"的头注释。
 *
 * 那条命令跑不起来。`synra-protocol` 没有 `[features]` 段，也没有 `ts_export` 模块 —— 整个导出路径
 * 从来没有存在过。`synra-ipc` 里确实有一个 `ts_export.rs`，但它只生成 `ErrorCode` 和
 * `SuggestedAction` 两个联合类型，**不生成** `ui.ts` / `wire.ts` / `events.ts`。这三个文件是手写的。
 *
 * 一个跑不起来的生成器比没有生成器更糟：头注释写着"自动生成，请勿手动修改"，于是没有人去查；
 * `check-shapes.ts` 原来断言的也是那几行注释在，于是检查保护的是这句话本身，而不是它说的事。
 *
 * # 现在的做法
 *
 * 不生成，只核对。`check-shapes.ts` 现在逐个字段地对照 Rust 的 DTO 与 TS 的 interface，两个方向都查，
 * 并在两边对不上时失败。那是一项会失败的检查，所以它才能防止手写镜像漂移 —— 而一句"请勿手改"不能。
 *
 * 生成仍然是更好的方向：一份 DTO 声明生成一份 TS，比手写镜像更难出错。做到它需要先在
 * `synra-protocol` / `synra-ipc` 里有一个真的导出器；那时候这个脚本会重新变成生成器，而在此之前，
 * 诚实地核对比假装生成要有用。
 *
 * # 退出码
 *
 * 核对失败时退出非零。核对通过时也退出非零并说明原因 —— 因为这个脚本已经不产出任何东西，
 * 让人以为"跑一下就重新生成过了"比让它明确地说"这里没有生成器"要糟。
 */

import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const jsRoot = resolve(here, '..')
const coreRoot = join(jsRoot, '..', 'synra-rust-core')
const dtoDirectory = join(coreRoot, 'crates', 'synra-ipc', 'src', 'dto')
const generatedDir = join(jsRoot, 'packages', 'protocol', 'src', 'generated')

function main(): void {
  console.error('✗ `sync` does not generate anything.\n')
  console.error('  `packages/protocol/src/generated/` is hand-written. It used to claim otherwise, and the claim\n')
  console.error('  named a command that cannot run: `synra-protocol` has no `ts-export` feature and no exporter.\n')
  console.error('  The mirror is now checked field by field instead, which is a check that can fail — run\n')
  console.error('  `pnpm run shapes` to see whether the mirror still matches the kernel.\n')

  if (existsSync(dtoDirectory)) {
    const dtos = readdirSync(dtoDirectory).filter((name: string): boolean => name.endsWith('.rs')).length
    const files = readdirSync(generatedDir).filter((name: string): boolean => name.endsWith('.ts')).length
    console.error(`  ${String(dtos)} Rust DTO file(s) are mirrored by ${String(files)} hand-written file(s).\n`)
  }

  process.exit(1)
}


main()
