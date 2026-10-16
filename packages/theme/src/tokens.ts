/**
 * 设计 token —— **这个包，以及整个产品的样式，只有这一份真相源**。
 *
 * # 为什么是数据，不是一串 CSS
 *
 * 同一组值要出现在三个地方，而它们的消费者不同：
 *
 * - **UnoCSS 的 `theme`**：生成 `bg-surface` / `text-ink-dim` 这样的工具类（`./unocss`）；
 * - **CSS 变量**：`var(--synra-surface)`，给不写工具类的地方、以及内联的反闪屏那一小段（`./css`）；
 * - **别的 UI 系统**：VitePress 的品牌变量、将来的某个组件库（各自一个子路径）。
 *
 * 如果这三处各写一遍，"改一支紫"就变成一次三处对齐的手工操作，而漏掉一处不会报错 ——
 * 只会让某个界面比别处旧一点。所以它们是**从这里算出来的**：
 *
 * ```
 * colors ──┬──► theme.colors（值是 var(...)，见 ./unocss 里的说明）
 *          └──► :root { --synra-surface: … }（cssVariables()）
 * ```
 *
 * # 命名
 *
 * 变量一律 `--synra-*`。不带前缀的 `--border` 与任何第三方 CSS 变量都是必然碰撞，
 * 而症状是"某个面板偶尔变透明"。（设计文档 28 §3 R7）
 *
 * # 为什么按家族分开，而这个文件还在
 *
 * 业主的规矩是源文件不该长，而这一份曾经是一整段：颜色、材质、字、圆角、层级、动效、断点、
 * 对比度表 —— 各自的读者都不同。现在每个家族一个文件（`./tokens/*.js`），而**入口路径一个字
 * 没变**：`../tokens.js` 仍然导出原来那些名字，只是它们从各自的文件来。这个文件留下的，是
 * 那份"只有一份真相源"的说明，和唯一一个**跨家族**的函数 —— 变量表。
 */

import { colors } from './tokens/color.js'
import { focusRing, glass, glow } from './tokens/material.js'
import { duration, ease, radius, zIndex } from './tokens/scale.js'
import { fontFamily } from './tokens/type.js'

export { colors, withAlpha } from './tokens/color.js'
export { contrastPairs, themeConvention } from './tokens/convention.js'
export type { ContrastPair } from './tokens/convention.js'
export { focusRing, glass, glow } from './tokens/material.js'
export { breakpoints, duration, ease, radius, zIndex } from './tokens/scale.js'
export { fontFamily, fontSize, fontWeight } from './tokens/type.js'

/** `camelCase` → `kebab-case`，变量名与键名之间的唯一转换。 */
function kebab(key: string): string {
  return key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
}

/**
 * 全部 CSS 变量，名字 → 值。
 *
 * 颜色是**遍历**出来的，所以"变量名集合 == 颜色键集合"不是靠人工对齐，而是结构上成立 ——
 * 加一个颜色就自动多一个变量。（守卫见设计文档 28 §13.2 第 1 条）
 *
 * ★ 这个函数是唯一一个非留在这里不可的东西：它把**每个**家族读一遍，所以它不属于其中任何一个。
 *   （`breakpoints` 与 `contrastPairs` 不发变量：前者是 UnoCSS 的断点配置，后者是守卫要算的表。）
 */
export function cssVariables(): Record<string, string> {
  const variables: Record<string, string> = {}

  for (const [key, value] of Object.entries(colors)) {
    variables[`--synra-${kebab(key)}`] = value
  }

  variables['--synra-glass'] = glass.color
  variables['--synra-glass-base'] = glass.base
  variables['--synra-blur'] = glass.blur
  // ★ 饱和度也成为一个变量，理由是它**出现在两处**：UnoCSS 的 `floating` shortcut 与
  //   `@synra/theme/antd` 那段给浮起层的 CSS。写两遍 140% 就是两处会漂移的取值（R6/R46）。
  variables['--synra-saturate'] = glass.saturate
  variables['--synra-glow'] = glow
  variables['--synra-focus-ring'] = focusRing

  for (const [key, value] of Object.entries(fontFamily)) {
    variables[`--synra-font-${kebab(key)}`] = value
  }

  for (const [key, value] of Object.entries(radius)) {
    variables[`--synra-radius-${kebab(key)}`] = value
  }
  for (const [key, value] of Object.entries(zIndex)) {
    variables[`--synra-z-${kebab(key)}`] = String(value)
  }
  for (const [key, value] of Object.entries(duration)) {
    variables[`--synra-duration-${kebab(key)}`] = value
  }
  for (const [key, value] of Object.entries(ease)) {
    variables[`--synra-ease-${kebab(key)}`] = value
  }

  return variables
}
