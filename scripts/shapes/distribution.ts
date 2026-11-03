import type { ShapeContext } from './context'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export function checkDistribution(context: ShapeContext): void {
  const { jsRoot, read, fail, evidence } = context
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
}
