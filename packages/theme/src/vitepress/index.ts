/**
 * `@synra/theme/vitepress` —— 官网（VitePress）的品牌映射。
 *
 * # 为什么官网需要一个子路径，而不是抄四个色值
 *
 * 官网**是**这套东西的消费者（设计文档 28 §1.2），但它要的东西和宿主不一样：它跑在 VitePress 的
 * 默认主题上，能动的只有 `--vp-c-brand-*` 那几个变量。原先的写法是在 `chrome.css` 里手写一遍
 * 指向我们变量的映射 —— 那是**副本**，而副本唯一的维护机制是"评审时有人记得"。
 *
 * # 为什么亮色与暗色用的是**两支不同的紫**
 *
 * 因为"能读的紫"在两种底色上是两个值，而这是实测出来的（不是选出来的）：
 *
 * | 主题 | `--vp-c-brand-1` | 底色 | 对比度 |
 * | - | - | - | - |
 * | 亮色 | `primaryDeep` `#5b3fd6` | 白 | 6.72:1 |
 * | 暗色 | `primaryInk` `#b9a5ff` | VitePress 暗底 `#1b1b1f` | 8.08:1 |
 *
 * 而**应用是暗色专用的**（v1 只有深色），所以那一套 token 在亮色主题里不能用 —— 那正是"官网要单独
 * 映射一次"的根因，也是它不能简单地把 `--vp-c-brand-*` 指向 `--synra-*` 的原因。
 */

import { colors, withAlpha } from '../tokens.js'

/** VitePress 认的那几个品牌变量，按主题各一份。 */
export const vitepressBrand = {
  light: {
    /** 链接与主色**文字**：亮底上能读的那一支。 */
    '--vp-c-brand-1': colors.primaryDeep,
    '--vp-c-brand-2': colors.primary,
    '--vp-c-brand-3': colors.primary,
    '--vp-c-brand-soft': withAlpha(colors.primary, 14),
  },
  dark: {
    '--vp-c-brand-1': colors.primaryInk,
    '--vp-c-brand-2': colors.primary,
    '--vp-c-brand-3': colors.primary,
    '--vp-c-brand-soft': withAlpha(colors.primary, 18),
  },
} as const satisfies Record<string, Record<string, string>>

/** 主题约定：VitePress 的暗色模式也是在 `<html>` 上加 `dark` 类，与宿主 `index.html` 的约定相同。 */
export const vitepressDarkSelector = '.dark' as const

function declarations(variables: Record<string, string>): string {
  return Object.entries(variables)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n')
}

/**
 * 要注入官网的两段 CSS。
 *
 * ```ts
 * // .vitepress/theme/index.ts
 * import { vitepressBrandCss } from '@synra/theme/vitepress'
 * ```
 *
 * 也可以不用这段文本，而只取 `vitepressBrand` 那两个对象 —— 有的主题要按自己的方式写进去。
 */
export function vitepressBrandCss(): string {
  return `:root {\n${declarations(vitepressBrand.light)}\n}\n\n${vitepressDarkSelector} {\n${declarations(vitepressBrand.dark)}\n}\n`
}
