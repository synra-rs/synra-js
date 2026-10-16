/**
 * `@synra/theme/antd` 的守卫。
 *
 * 三件事各一条，都是"会静默漂移"的那一类：
 *
 * ① **对照表与取值表必须一致**：`synraAntdTokenMap` 是给插件作者看的文档，而文档会漂移。
 * ② **适配器不许引入新取值**：它是映射，不是第二份真相源（R6）。这条测试把"允许出现的值"
 *    从 token 里算出来，然后要求映射里的每一个值都在其中 —— 一个新写下的 `#7c5cff` 会让它变红。
 * ③ **那段 CSS 必须用变量并带回退**：没有回退时，没有 `backdrop-filter` 的 WebView 会拿到
 *    "半透明但不模糊"的面，而那正是 R43/R53 不允许的那一种。
 */
import { describe, expect, it } from 'vitest'

import { synraAntdFloatingCss, synraAntdTheme, synraAntdTokenMap } from '../src/antd/index.js'
import { colors, cssVariables, duration, ease, fontFamily, fontSize, glass, radius, withAlpha } from '../src/tokens.js'

const theme = synraAntdTheme()

/** 我们的尺寸 token 是带单位的字符串，antd 要数字 —— 与适配器里同一个换算。 */
function px(size: string): number {
  return Number.parseFloat(size)
}

describe('映射表与取值表不许漂移', () => {
  it('对照表里每个 antd 键都真的被赋值', () => {
    for (const [ours, antdKey] of Object.entries(synraAntdTokenMap)) {
      expect(theme.token?.[antdKey as keyof typeof theme.token], `${ours} → ${antdKey}`).toBeDefined()
    }
  })

  it('对照表里每个 --synra-* 都真的存在', () => {
    const variables = cssVariables()

    for (const ours of Object.keys(synraAntdTokenMap)) {
      expect(variables, `${ours} 不在 cssVariables() 里`).toHaveProperty(ours)
    }
  })
})

describe('适配器不许引入新取值', () => {
  it('每个值都能追到某个 token', () => {
    const allowed = new Set<string | number>([
      ...Object.values(colors),
      withAlpha(colors.raised, 40),
      glass.color,
      ...Object.values(radius).map(px),
      ...Object.values(duration),
      ease.standard,
      fontFamily.sans,
      ...Object.values(fontSize).map(size => Number.parseFloat(size[0])),
      Number.parseFloat(fontSize.base[1]),
      // 阴影必须被关掉，而 `'none'` 不是"一个取值"，是"没有取值"（R53）。
      'none',
    ])

    for (const [key, value] of Object.entries(theme.token ?? {})) {
      expect(allowed.has(value as string | number), `${key} = ${String(value)} 追不到 token`).toBe(true)
    }
  })
})

describe('浮起层的 CSS', () => {
  const css = synraAntdFloatingCss()

  it('用变量表达材质，不写字面值', () => {
    expect(css).toContain('var(--synra-blur)')
    expect(css).toContain('var(--synra-saturate)')
    expect(css).not.toMatch(/\d+px/)
    expect(css).not.toMatch(/#[0-9a-f]{3,8}/i)
  })

  it('带 @supports 回退，且回退落到不透明的基底（R43/R44）', () => {
    // 探针写成 `blur(0)` 而不是 `blur(1px)`：这一段的判据是"CSS 里不许出现字面尺寸"，
    // 而 `1px` 是一个尺寸 —— 哪怕它只出现在特性探测里，也会让上面那条断言变成一句需要解释的例外。
    expect(css).toContain('@supports not (backdrop-filter: blur(0))')
    expect(css).toContain('var(--synra-glass-base)')
  })

  it('覆盖了每一个被点名要玻璃的浮起组件（R53 的可检查名单）', () => {
    for (const selector of [
      '.ant-modal-content',
      '.ant-drawer-content',
      '.ant-dropdown-menu',
      '.ant-select-dropdown',
      '.ant-picker-dropdown',
      '.ant-tooltip-inner',
      '.ant-popover-inner',
    ]) {
      expect(css, selector).toContain(selector)
    }
  })

  it('带上 -webkit- 前缀（WebKit 上 backdrop-filter 需要它）', () => {
    expect(css).toContain('-webkit-backdrop-filter')
  })
})
