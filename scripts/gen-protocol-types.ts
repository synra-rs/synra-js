#!/usr/bin/env tsx
/**
 * 从内核仓库拉协议类型。
 *
 * # 为什么生成物要 commit 进仓库
 *
 * 插件作者的 UI 代码只用发布包：他们不写 Rust、不编译 Rust。所以发布包必须**自带完整类型**，
 * 而"发布时再生成"会让发布依赖两个仓库的 CI 同时可用。
 *
 * 另外，生成物进 diff 让"线上契约变了"在 review 里可见 —— 那是一个需要被看见的改动，不是一个
 * 构建细节。
 *
 * # 这个脚本做的事
 *
 * 1. 在 `synra-rust-core` 里跑 `cargo test -p synra-protocol --features ts-export`，导出到
 *    `target/ts-export/`。
 * 2. 把导出的 `.ts` 复制到 `packages/protocol/src/generated/`。
 * 3. 给每个文件加上"请勿手改"的头注释与一个 eslint-disable。
 * 4. 打印 diff 摘要，让人能看到这次同步改了什么。
 *
 * # 没有 Rust 工具链时
 *
 * 报错退出，而不是写一个空文件。一个"同步成功但什么都没同步"的结果比失败更糟：它会让守卫通过，
 * 而类型其实没更新。
 */

import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const jsRoot = resolve(here, '..')
const repoRoot = resolve(jsRoot, '..')
const coreRoot = join(repoRoot, 'synra-rust-core')
const exportDir = join(coreRoot, 'target', 'ts-export')
const targetDir = join(jsRoot, 'packages', 'protocol', 'src', 'generated')

/** 每个生成文件的开头。三行内容被 `check-shapes.ts` 断言，所以改这里要同时改那里。 */
function header(source: string): string {
  return `/* eslint-disable */
/**
 * ⚠️ 自动生成，请勿手动修改。
 *
 * 来源：${source}
 * 生成：cargo test -p synra-protocol --features ts-export
 * 同步：pnpm --filter @synra/protocol sync
 */
`
}

function main(): void {
  if (!existsSync(coreRoot)) {
    console.error(
      `✗ the kernel repository was not found at ${coreRoot}\n` +
        '  `sync` needs it: the protocol types are generated from the Rust crate, not written here.',
    )
    process.exit(1)
  }

  console.log('· running the Rust export …')
  try {
    execFileSync('cargo', ['test', '-p', 'synra-protocol', '--features', 'ts-export'], {
      cwd: coreRoot,
      stdio: 'inherit',
    })
  } catch {
    console.error(
      '✗ the Rust export failed. The types were not changed, so the committed ones are still the\n' +
        '  previous generation — run `pnpm run shapes` to see whether they still match the crate.',
    )
    process.exit(1)
  }

  if (!existsSync(exportDir)) {
    console.error(
      `✗ cargo reported success but ${exportDir} does not exist.\n` +
        '  Check that the `ts-export` feature writes there; refusing to write an empty generation.',
    )
    process.exit(1)
  }

  const files = readdirSync(exportDir).filter((name) => name.endsWith('.ts'))
  if (files.length === 0) {
    console.error(`✗ ${exportDir} contains no .ts files; refusing to write an empty generation.`)
    process.exit(1)
  }

  mkdirSync(targetDir, { recursive: true })
  let changed = 0
  for (const name of files) {
    const source = readFileSync(join(exportDir, name), 'utf8')
    const withHeader = `${header('synra-core/crates/synra-protocol')}${source.replace(/^\/\* eslint-disable \*\/\n/, '')}`
    const destination = join(targetDir, name)
    const previous = existsSync(destination) ? readFileSync(destination, 'utf8') : ''
    if (previous !== withHeader) changed += 1
    writeFileSync(destination, withHeader, 'utf8')
  }

  // 入口文件也要重写一次，因为内核导出的类型集合可能变了。
  cpSync(exportDir, targetDir, { recursive: true, force: true })

  console.log(
    changed === 0
      ? `✓ ${files.length} file(s) synced; nothing changed`
      : `✓ ${files.length} file(s) synced; ${changed} changed — review the diff, then commit`,
  )

  if (changed > 0) {
    console.log(
      '  a changed generated type means the wire contract changed. That is a deliberate act:\n' +
        '  bump the three packages together (`pnpm run release`) and say so in the changelog.',
    )
  }
}

main()