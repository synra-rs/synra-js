import type { ShapeContext } from './context'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export function checkTheme(context: ShapeContext): void {
  const { jsRoot, read, fail, evidence } = context
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
}

function importsDependency(source: string, dependency: string): boolean {
  // 先去掉行注释，否则一句"不要 import 'unocss'"的注释会把守卫骗红。
  const code = source.replace(/\/\/[^\n]*/g, '')
  const name = dependency.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  return new RegExp(`(?:^|\\n)[ \\t]*(?:import|export)\\b[^;]*?['"]${name}['"]`).test(code)
    || new RegExp(`\\bimport\\s*\\(\\s*['"]${name}['"]`).test(code)
}
