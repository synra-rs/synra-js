/**
 * token 变成 CSS 文本，**分两段**。
 *
 * # 为什么是两段而不是一段
 *
 * reset 是**文档级**的决定（它会动 `html` / `body` / `*`），而 token 变量是**跨仓库共享**的东西。
 * 把它们绑在同一个开关上，"想共享颜色"就必然"接受一份 reset"—— 而官网正是**不能**接受 reset 的
 * 那个消费者：它跑在 VitePress 的默认主题上，一份 reset 会把那里的排版打散。
 *
 * 所以有三档（设计文档 28 §15 R47）：
 *
 * | 档 | 发出什么 | 谁用 |
 * | - | - | - |
 * | `app` | reset + 变量 | 宿主界面、插件页面 —— 各自是独立文档，reset 是安全的 |
 * | `tokens` | 只有变量 | 官网 |
 * | `none` | 都不发 | 测试，以及"只要工具类不要变量"的场合 |
 *
 * # reset 为什么这么短
 *
 * 一份大 reset 就是第二套设计系统：它有自己的假设（行高、标题边距、列表符号），而那些假设会和
 * 使用它的页面的假设打架，且打架的结果是"某些地方对不齐"。这里只放**没有争议**的那几条。
 */

import { cssVariables, themeConvention } from './tokens.js'

/** 发哪几段。见这个文件的头部。 */
export type PreflightTier = 'app' | 'tokens' | 'none'

/**
 * token 层：只有变量声明。
 *
 * ★ **没有任何元素选择器**（`html` / `body` / `*`），只有 `:root` —— 这条由测试钉住，
 * 因为"官网能用"完全取决于它。
 */
export function tokensCss(): string {
  const declarations = Object.entries(cssVariables())
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n')
  return `${themeConvention.selector} {\n${declarations}\n}`
}

/**
 * reset 层：有元素选择器的那些，只允许 `app` 档发。
 *
 * `font-size` 用 `rem` 表达 14px 而不是把根字号改成 14px：根字号必须保持默认，
 * 否则所有 `rem` 语义的工具类都静默地只有作者以为的 87.5%。（设计文档 28 §5 R19）
 */
export function resetCss(): string {
  return [
    ':root {',
    `  color-scheme: ${themeConvention.colorScheme};`,
    '}',
    '',
    '*, *::before, *::after {',
    '  box-sizing: border-box;',
    '}',
    '',
    'body {',
    '  margin: 0;',
    '  background: var(--synra-screen);',
    '  color: var(--synra-ink);',
    '  font-family: var(--synra-font-sans);',
    '  font-size: 0.875rem;',
    '  line-height: 1.55;',
    '}',
    '',
    '/* ★ R30（尊重"减少动效"）只能在这一层兑现，这是它必须写在这里的原因。',
    '',
    '   我们自己的动效是工具类（`motion-reduce:animate-none`），作者写就有、不写就没有 —— 也就是说它靠自觉。',
    '   而**组件库的动效我们够不着**：antd 的过渡由它自己的 CSS-in-JS 注入，一个工具类到不了那里。',
    '   文档层的 `*` 是唯一能同时覆盖"我们的"和"库的"的那支选择器，所以 R30 的最后一道防线在这里。',
    '',
    '   用 0.01ms 而不是 0：某些浏览器会把 0 当作"没有声明"而继续动画，而 0.01ms 短到看不出来、又确实是声明。',
    '   只发在 `app` 档，因为这是**元素选择器** —— 官网那份 reset 的边界（本文件头部）同样适用于它。 */',
    '@media (prefers-reduced-motion: reduce) {',
    '  *, *::before, *::after {',
    '    animation-duration: 0.01ms !important;',
    '    animation-iteration-count: 1 !important;',
    '    transition-duration: 0.01ms !important;',
    '    scroll-behavior: auto !important;',
    '  }',
    '}',
  ].join('\n')
}

/** 按档拼出要注入的 CSS。空字符串表示这一档什么都不发。 */
export function css(tier: PreflightTier): string {
  if (tier === 'none') {
    return ''
  }
  if (tier === 'tokens') {
    return `${tokensCss()}\n`
  }
  return `${resetCss()}\n\n${tokensCss()}\n`
}
