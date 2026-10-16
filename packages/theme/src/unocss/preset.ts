/**
 * `presetSynra` —— token 变成 UnoCSS 的 theme、preflight 与 shortcuts。
 *
 * # theme 的值是 `var(--synra-*)`，不是色值
 *
 * 因为那样"工具类"和"CSS 变量"就是**同一条声明**，而不是两份需要人工对齐的东西：
 * `bg-surface` 编译成 `background-color: var(--synra-surface)`，而 `--synra-surface` 由
 * preflight 从同一份 token 发出来。改一支紫只改一处。
 *
 * ⚠️ 代价说清楚：`var()` 颜色**不支持透明度修饰**（`bg-surface/50` 不会按预期工作）。
 * 要半透明的面就用已经带 alpha 的 token（`bg-glass`），而不是给不透明的 token 加个后缀。
 *
 * # `presetWind3` 的 preflight 必须关掉
 *
 * 它自带 Tailwind 的 reset。留着它，`preflight: 'tokens'` 那一档就**名存实亡**——
 * 官网还是会拿到一份 reset，而它的排版会被打散。这是"官网能当消费者"的前提。
 */

import { presetWind3 } from 'unocss'
import type { Preset } from 'unocss'

import { breakpoints, colors, duration, ease, fontFamily, fontSize, glow, radius, zIndex } from '../tokens.js'
import { css } from '../css.js'
import type { PreflightTier } from '../css.js'
import { structuralShortcuts } from './shortcuts.js'

/** `presetSynra` 的选项。 */
export interface SynraPresetOptions {
  /**
   * 发哪几段 CSS。默认 `'app'`（reset + 变量）——那是独立文档的场合。
   * 官网必须传 `'tokens'`：它跑在 VitePress 的默认主题上。
   */
  readonly preflight?: PreflightTier
}

/** `camelCase` → `kebab-case`。与 `tokens.ts` 里那份是同一条规则，这里是工具类名的那一侧。 */
function kebab(key: string): string {
  return key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
}

/**
 * 工具类名 → `var(--synra-*)`。
 *
 * 颜色是**遍历**出来的（加一个 token 就自动多一个工具类），另外三个是单列的名字：
 * 毛玻璃的面、它的不透明基底、以及发光。
 */
export function synraThemeColors(): Record<string, string> {
  const mapped: Record<string, string> = {}
  for (const key of Object.keys(colors)) {
    mapped[kebab(key)] = `var(--synra-${kebab(key)})`
  }
  mapped.glass = 'var(--synra-glass)'
  mapped['glass-base'] = 'var(--synra-glass-base)'
  mapped.glow = 'var(--synra-glow)'
  return mapped
}

/**
 * `synraTheme()` 的形状。
 *
 * ★ 写出来而不是返回 `Preset['theme']`（那是 `object`）：调用方要能读到具体字段 ——
 *   测试要断言"只有一个模糊半径、一个发光"，而那两件事在 `object` 上是编译错误。
 */
export interface SynraTheme {
  readonly colors: Record<string, string>
  readonly fontFamily: Record<string, string>
  readonly fontSize: Record<string, readonly [string, string]>
  readonly breakpoints: Record<string, string>
  readonly borderRadius: Record<string, string>
  readonly zIndex: Record<string, number>
  readonly transitionDuration: Record<string, string>
  readonly transitionTimingFunction: Record<string, string>
  readonly blur: Record<string, string>
  readonly boxShadow: Record<string, string>
}

/**
 * token → UnoCSS 的 `theme`。
 *
 * 每一组都指向同一个变量，所以**没有任何一组是第二份真相源**。分开导出是为了让消费者自己写配置时
 * 可以直接展开它（而不是抄一遍值）。
 */
export function synraTheme(): SynraTheme {
  return {
    colors: synraThemeColors(),
    fontFamily,
    fontSize,
    breakpoints,
    // 从 `radius` 遍历出来：加一档圆角就自动多一个工具类（`rounded-control` / `-surface` / `-pill`）。
    borderRadius: Object.fromEntries(
      Object.entries(radius).map(([key]) => [kebab(key), `var(--synra-radius-${kebab(key)})`]),
    ),
    zIndex,
    transitionDuration: {
      fast: duration.fast,
      base: duration.base,
      slow: duration.slow,
    },
    transitionTimingFunction: {
      standard: ease.standard,
    },
    blur: {
      // 全局唯一的一个模糊半径：玻璃的"厚度"是材质，不是可调参数。
      synra: `var(--synra-blur)`,
    },
    boxShadow: {
      // 发光是一个**状态**，不是皮肤：只允许出现在焦点环、那条线的活动态、主按钮按下态。
      glow: `0 0 24px ${glow}`,
    },
  }
}

/**
 * 这套设计系统的 UnoCSS preset。
 *
 * 单独用它也可以（`presets: [presetSynra()]`），但**推荐用 `synraConfig()`**：
 * 禁用名单与图标策略是 config 级的，一个 preset 拿不到它们。
 */
export function presetSynra(options: SynraPresetOptions = {}): Preset {
  const tier = options.preflight ?? 'app'

  return {
    name: 'synra',
    theme: synraTheme(),
    // ★ `preflight: false`：见这个文件的头部。留一份 Tailwind 的 reset，官网就用不了 tokens 档。
    presets: [presetWind3({ preflight: false, dark: 'class' })],
    preflights: [
      {
        getCSS: () => css(tier),
      },
    ],
    shortcuts: structuralShortcuts,
  }
}
