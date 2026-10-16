/**
 * `@synra/theme/vitepress` 的守卫。
 *
 * 这一层最容易错的地方是**主题选错了那一支紫**：两支紫在各自的底色上都好看，而在对方的底色上读不了，
 * 且"读不了"不会让任何东西报错 —— 只是链接变淡。所以两边的品牌文字色都对着**它真正的底色**算一次。
 */

import { describe, expect, it } from 'vitest'

import { colors } from '../src/index.js'
import { vitepressBrand, vitepressBrandCss, vitepressDarkSelector } from '../src/vitepress/index.js'
import { contrast } from './contrast.js'

/** VitePress 自己的底色（默认主题）：亮色 `--vp-c-bg` 是白，暗色是 `#1b1b1f`。 */
const VITEPRESS_LIGHT_BACKGROUND = '#ffffff'
const VITEPRESS_DARK_BACKGROUND = '#1b1b1f'

describe('vitepressBrand', () => {
  it('uses the readable purple on each background', () => {
    expect(vitepressBrand.light['--vp-c-brand-1']).toBe(colors.primaryDeep)
    expect(vitepressBrand.dark['--vp-c-brand-1']).toBe(colors.primaryInk)
    // ★ 反过来才是那个静默的失效：亮底上用暗色主题那一支，链接就淡到读不清。
    expect(vitepressBrand.light['--vp-c-brand-1']).not.toBe(colors.primaryInk)
    expect(vitepressBrand.dark['--vp-c-brand-1']).not.toBe(colors.primaryDeep)
  })

  it('clears 4.5:1 on its own background, in both themes', () => {
    const light = contrast(vitepressBrand.light['--vp-c-brand-1'], VITEPRESS_LIGHT_BACKGROUND)
    const dark = contrast(vitepressBrand.dark['--vp-c-brand-1'], VITEPRESS_DARK_BACKGROUND)

    expect(light).toBeGreaterThanOrEqual(4.5)
    expect(dark).toBeGreaterThanOrEqual(4.5)
  })

  // 半透明的品牌底必须从**同一支紫**算出来：手写 `rgb(124 92 255 / 14%)` 会在换色时静默地留在旧色上。
  // 断言用的通道值是这里独立算的，不是从 `withAlpha` 拿的 —— 否则测的是它自己。
  it('derives the soft variants from the primary colour', () => {
    const channels = colors.primary
      .replace('#', '')
      .match(/.{2}/g)
      ?.map(pair => Number.parseInt(pair, 16))
      .join(' ')

    expect(channels).toBeDefined()
    for (const theme of ['light', 'dark'] as const) {
      const soft = vitepressBrand[theme]['--vp-c-brand-soft']
      expect(soft.startsWith('rgb(')).toBe(true)
      expect(soft).toContain(channels ?? '')
    }
    expect(vitepressBrand.light['--vp-c-brand-soft']).not.toBe(vitepressBrand.dark['--vp-c-brand-soft'])
  })

  it('keeps one primary for fills in both themes', () => {
    expect(vitepressBrand.light['--vp-c-brand-2']).toBe(colors.primary)
    expect(vitepressBrand.dark['--vp-c-brand-2']).toBe(colors.primary)
  })
})

describe('vitepressBrandCss', () => {
  it('writes the light mapping at the root and the dark one under the dark class', () => {
    const text = vitepressBrandCss()

    expect(text.startsWith(':root {')).toBe(true)
    expect(text).toContain(`${vitepressDarkSelector} {`)
    expect(text).toContain(`--vp-c-brand-1: ${colors.primaryDeep};`)
    expect(text).toContain(`--vp-c-brand-1: ${colors.primaryInk};`)
  })

  // ★ 它必须**不含元素选择器**：这段 CSS 会被注入 VitePress 的默认主题，一个 `body` 或 `*`
  //   就足以打散那里的排版。这条与 `tokensCss()` 的同名守卫是一回事。
  it('touches nothing but the variables', () => {
    const text = vitepressBrandCss()

    for (const forbidden of ['html', 'body', '*', '!important']) {
      expect(text.includes(forbidden), `不该出现 ${forbidden}`).toBe(false)
    }
  })
})
