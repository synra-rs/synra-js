/**
 * 主题约定，以及对比度守卫要算的成对声明。
 *
 * 这两样放在一起，是因为它们都回答"这些 token 会被用在什么上面"：前者是变量所在的层，后者是
 * 前景色与背景色的组合。守卫拿后面那张表算比值（`test/tokens.test.ts`）。
 */
import type { colors } from './color.js'

/**
 * 主题约定。
 *
 * v1 **只有深色**，所以 token 本身就是深色的值，`color-scheme` 也是 `dark` ——
 * 写着 `light dark` 而只有一套深色值，是一句自相矛盾的话。
 *
 * 将来要做亮色时，它是**一次独立的设计**（不是把深色取反）：加一段 `.light` 覆盖，不改名。
 */
export const themeConvention = {
  /** 变量所在的层。`html.dark` 是同一套约定，VitePress 用的也是它。 */
  selector: ':root',
  colorScheme: 'dark',
  /** 将来那套亮色覆盖要用的类名；现在没有任何地方加它。 */
  futureLightClass: 'light',
} as const

/**
 * 对比度守卫要算的**成对**声明。
 *
 * 每一条都是"这个前景色会出现在那个背景色上"，而 `minimum` 是 WCAG 的门槛：正文 4.5，大字与
 * 控件 3。玻璃面上的文字算在它的**基底**上（`glassBase`），不算在模糊结果上。
 */
export interface ContrastPair {
  readonly foreground: keyof typeof colors | 'glassBase'
  /** `glassBase` 也是一种背景：玻璃面上的文字算在它的不透明基底上。 */
  readonly background: keyof typeof colors | 'glassBase'
  readonly minimum: number
  readonly use: string
}

export const contrastPairs: readonly ContrastPair[] = [
  { foreground: 'ink', background: 'screen', minimum: 4.5, use: '正文 / 页面底' },
  { foreground: 'ink', background: 'surface', minimum: 4.5, use: '正文 / 面板' },
  { foreground: 'ink', background: 'raised', minimum: 4.5, use: '正文 / 抬起层' },
  { foreground: 'inkDim', background: 'screen', minimum: 4.5, use: '次要文字 / 页面底' },
  { foreground: 'inkDim', background: 'surface', minimum: 4.5, use: '次要文字 / 面板' },
  { foreground: 'inkDim', background: 'raised', minimum: 4.5, use: '次要文字 / 抬起层' },
  { foreground: 'inkDim', background: 'glassBase', minimum: 4.5, use: '次要文字 / 玻璃面（按基底算）' },
  { foreground: 'primaryInk', background: 'screen', minimum: 4.5, use: '链接 / 页面底' },
  { foreground: 'primaryInk', background: 'raised', minimum: 4.5, use: '链接 / 抬起层' },
  { foreground: 'primary', background: 'screen', minimum: 3, use: '主色填充与光晕 / 页面底' },
  { foreground: 'primary', background: 'raised', minimum: 3, use: '主色填充与光晕 / 抬起层' },
  { foreground: 'lineStrong', background: 'raised', minimum: 3, use: '控件边界' },
  { foreground: 'ok', background: 'screen', minimum: 4.5, use: '状态 / 页面底' },
  { foreground: 'warn', background: 'screen', minimum: 4.5, use: '状态 / 页面底' },
  { foreground: 'danger', background: 'screen', minimum: 4.5, use: '状态 / 页面底' },
  { foreground: 'offline', background: 'screen', minimum: 4.5, use: '状态 / 页面底' },
]
