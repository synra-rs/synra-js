/**
 * 标签与包里写的版本是否一致。
 *
 * # 为什么这件事必须在发布**之前**查
 *
 * 到了 registry 的版本收不回来，只能 deprecate。而"打的标签和包里的版本不是同一个号"是最容易发生、
 * 又最难在事后补救的一种错：`v0.2.0` 这个标签本身没错，是它指向的提交里那几个包还写着 `0.1.0`——
 * 于是 npm 上多出一个与标签无关的版本，而标签看起来一切正常。
 *
 * # 为什么"没有标签"必须失败
 *
 * 本机的 `pnpm run check:release-tag` 没有 `GITHUB_REF_NAME`。此时最坏的结果不是报错，而是**通过**——
 * 一次什么都没查的绿色运行，与一次真的对上了的绿色运行，在输出里长得一样。
 * 所以缺标签是一个问题，而不是"跳过"。
 *
 * 用法：`GITHUB_REF_NAME=v0.1.0 pnpm run check:release-tag`（CI 里这个变量由 Actions 给）。
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/** 一个会进 registry 的包，以及它声称的版本。 */
export interface PackageVersion {
  readonly name: string
  readonly version: string
}

/**
 * 标签与版本之间的全部问题，空列表表示一致。
 *
 * 纯函数：它决定的事（"这次发布对不对"）错了不会抛错，只会让一次错的发布看起来是对的。
 */
export function releaseTagProblems(tag: string, packages: readonly PackageVersion[]): string[] {
  const problems: string[] = []

  if (tag === '') {
    problems.push('GITHUB_REF_NAME 没有设置或为空，所以没有标签可以对照。本机跑要显式给一个，例如 GITHUB_REF_NAME=v0.1.0')
    return problems
  }

  for (const entry of packages) {
    if (entry.version !== tag) {
      problems.push(`${entry.name}@${entry.version} 与标签 v${tag} 不一致`)
    }
  }

  // 一个都没有也是问题：那说明包目录读错了（改过目录结构、或者 `private` 标记把每个包都排除了），
  // 而"没有可发布的包"和"每个包都对上了"都会得到空的 problems。
  if (packages.length === 0) {
    problems.push('没有找到任何会发布的包，所以这次对照没有检查到东西')
  }

  return problems
}

/**
 * 读工作区里所有会发布的包。
 *
 * `private: true` 的包不进 registry，所以它的版本与标签无关——`testkit` 目前不是私有的，
 * 但这条规则写在这里，是为了将来有人把某个包标成私有时不必同时改这里。
 */
export function readPublishableVersions(root: string): PackageVersion[] {
  const packagesDirectory = join(root, 'packages')
  const found: PackageVersion[] = []
  for (const entry of readdirSync(packagesDirectory, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue
    }
    const manifest = join(packagesDirectory, entry.name, 'package.json')
    if (!existsSync(manifest)) {
      continue
    }
    const parsed = JSON.parse(readFileSync(manifest, 'utf8')) as {
      name?: string
      version?: string
      private?: boolean
    }
    if (parsed.private === true) {
      continue
    }
    if (!parsed.name || !parsed.version) {
      throw new Error(`${manifest} 没有 name 或 version`)
    }
    found.push({ name: parsed.name, version: parsed.version })
  }
  return found
}

function main(): void {
  const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
  const tag = (process.env.GITHUB_REF_NAME ?? '').replace(/^v/, '')
  const packages = readPublishableVersions(root)
  const problems = releaseTagProblems(tag, packages)

  if (problems.length > 0) {
    for (const problem of problems) {
      process.stderr.write(`✗ ${problem}\n`)
    }
    process.exit(1)
  }

  process.stdout.write(`✓ 标签 v${tag} 与 ${String(packages.length)} 个包的版本一致\n`)
}

// 只有作为程序运行时才跑，这样测试可以直接 import 上面两个纯函数。
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
