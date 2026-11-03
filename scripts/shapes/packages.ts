import type { ShapeContext } from './context'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export function checkPackages(context: ShapeContext): void {
  const { jsRoot, read, fail, evidence } = context
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
}
