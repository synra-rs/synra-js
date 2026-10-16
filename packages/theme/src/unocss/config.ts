/**
 * `synraConfig` —— 一份可以直接展开的完整配置。
 *
 * # 为什么必须导出它，而不只是 preset
 *
 * `blocklist` 与 `presetIcons` 都是 **config 级**的旋钮，一个 `Preset` 拿不到它们。
 * 只给 preset 的后果是每个消费者各自抄一份禁用名单 —— 而那正是这整套东西想消灭的、会漂移的拷贝。
 *
 * ```ts
 * // uno.config.ts（宿主 / 插件 / 官网都一样，只有 preflight 档不同）
 * import { defineConfig } from 'unocss'
 * import { synraConfig } from '@synra/theme/unocss'
 *
 * export default defineConfig({ ...synraConfig() })
 * ```
 *
 * # 图标：`cdn: false`
 *
 * 宿主主窗口与插件页面的 CSP 都是 `'self'`，而 `connect-src` 是 `none`。运行期去 CDN 取图标
 * **必然失败**，而失败的样子是一排空方块 —— 它看起来像图标库坏了，而不是像网络被拒。
 * 所以图标一律构建期内联（`cdn: false`），并用 `@iconify-json/*` 作为 devDependency。
 */

import type { UserConfig } from 'unocss'
import type { SynraPresetOptions } from './preset.js'

import { presetIcons } from 'unocss'
import { synraBlocklist } from './blocklist.js'
import { presetSynra } from './preset.js'

/** `synraConfig` 的选项。 */
export interface SynraConfigOptions extends SynraPresetOptions {
  /**
   * 是否带上图标预设。默认 `true`——它只在你**用到**图标类时才会产出任何东西，
   * 而且 `cdn: false` 已经堵掉了唯一的运行期请求。
   */
  readonly icons?: boolean
}

/** 一份完整的 UnoCSS 配置，含 preset、禁用名单与图标策略。 */
export function synraConfig(options: SynraConfigOptions = {}): UserConfig {
  const { icons = true, ...presetOptions } = options

  return {
    presets: [
      presetSynra(presetOptions),
      ...(icons
        ? [
            presetIcons({
              // ★ **不设 `cdn`**，而不是 `cdn: false`。
              //
              //   在 `@unocss/preset-icons@66` 里 `cdn?: string` —— 它只收一个 URL，没有"关掉"的布尔值
              //   （老配方 `cdn: false` 现在是类型错误）。而**不设它**就是"不取 CDN"：图标一律在构建期
              //   从本地的 `@iconify-json/*` 内联进来。
              //
              //   为什么必须这样：宿主主窗口与插件页面的 CSP 都是 `connect-src 'none'`，运行期去取图标
              //   必然失败，而失败的样子是一排空方块 —— 它看起来像图标库坏了，而不是像网络被拒。
              scale: 1,
              extraProperties: {
                'display': 'inline-block',
                'vertical-align': 'text-bottom',
              },
            }),
          ]
        : []),
    ],
    blocklist: synraBlocklist,
  }
}
