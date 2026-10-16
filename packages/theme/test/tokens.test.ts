/**
 * token 层的三条守卫。
 *
 * # 为什么这些是测试而不是文档里的一句话
 *
 * 这一层错起来是**静默**的：一个颜色没有对应变量（`var(--synra-…)` 取到空值）、一对前景背景
 * 读不清、玻璃面没有基底 —— 三件都不会让任何东西报错，只会让某个界面看起来"有点不对"。
 * 所以它们各有断言，而断言里的数字是**算出来的**，不是抄来的。
 */

import { describe, expect, it } from 'vitest'

import { colors, contrastPairs, cssVariables, glass, glow, tokensCss } from '../src/index.js'
import type { ContrastPair } from '../src/index.js'

/** 解析一个对比度端点：`glassBase` 指的是玻璃的**不透明基底**，不是一支颜色。 */
function endpoint(name: ContrastPair['foreground']): string {
  return name === 'glassBase' ? glass.base : colors[name]
}

/** WCAG 相对亮度。 */
function luminance(hex: string): number {
  const digits = hex.replace('#', '')
  const channels = [0, 2, 4].map((at) => Number.parseInt(digits.slice(at, at + 2), 16) / 255)
  const [red = 0, green = 0, blue = 0] = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

/** WCAG 对比度，1:1 到 21:1。 */
export function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((left, right) => right - left)
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05)
}

describe('cssVariables', () => {
  // ★ 这条是"单一真相源"的机械形式：颜色是**遍历**出来的，所以不可能出现一个颜色没有变量、
  //   或者一个变量没有颜色。手工维护两张表时，这两件事都会发生，而且都没有症状。
  it('has exactly one variable per colour, named --synra-<kebab-key>', () => {
    const variables = cssVariables()

    for (const key of Object.keys(colors)) {
      const name = `--synra-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`
      expect(variables[name], `${name} 应该存在`).toBe(colors[key as keyof typeof colors])
    }

    const colourVariables = Object.keys(variables).filter(name => /^--synra-(?!glass|blur|glow|focus|font|radius|z-|duration|ease)/.test(name))
    expect(colourVariables).toHaveLength(Object.keys(colors).length)
  })

  // ★ 这是 token 的**预算**：加一个 token 就要改这个列表，于是"加"是一次显式决定，而不是
  //   顺手多一点。一份没有预算的 token 表会稳步长到没人敢删任何一项。
  it('is the whole set, so adding one is a deliberate change', () => {
    expect(Object.keys(cssVariables()).sort()).toEqual(
      [
        '--synra-blur',
        '--synra-danger',
        '--synra-duration-base',
        '--synra-duration-fast',
        '--synra-duration-slow',
        '--synra-ease-standard',
        '--synra-focus-ring',
        '--synra-font-mono',
        '--synra-font-sans',
        '--synra-glass',
        '--synra-glass-base',
        '--synra-glow',
        '--synra-ink',
        '--synra-ink-dim',
        '--synra-line',
        '--synra-line-strong',
        '--synra-offline',
        '--synra-ok',
        '--synra-primary',
        '--synra-primary-deep',
        '--synra-primary-ink',
        '--synra-radius-control',
        '--synra-radius-pill',
        '--synra-radius-surface',
        '--synra-raised',
        '--synra-screen',
        '--synra-surface',
        '--synra-warn',
        '--synra-z-base',
        '--synra-z-drag',
        '--synra-z-modal',
        '--synra-z-overlay',
        '--synra-z-panel',
        '--synra-z-toast',
      ].sort(),
    )
  })
})

describe('contrastPairs', () => {
  it('every pair clears its own minimum', () => {
    const failures: string[] = []

    for (const pair of contrastPairs) {
      const measured = contrast(endpoint(pair.foreground), endpoint(pair.background))
      if (measured < pair.minimum) {
        failures.push(
          `${pair.use}: ${pair.foreground} on ${pair.background} is ${measured.toFixed(2)}:1, needs ${String(pair.minimum)}:1`,
        )
      }
    }

    expect(failures).toEqual([])
  })

  // ★ 玻璃面上的文字算在**基底**上，不算在模糊结果上 —— 而"有一个基底"必须被钉住，
  //   否则这一对会悄悄变成对着一个不是颜色的东西算比值。
  it('measures text on glass against the opaque base', () => {
    expect(Object.values(colors)).toContain(glass.base)
    expect(contrastPairs.some(pair => pair.background === 'glassBase')).toBe(true)
  })
})

describe('the material tokens', () => {
  // 玻璃的"厚度"与发光的"强度"是材质，不是可调参数：两个模糊半径会让同一屏出现两种玻璃，
  // 而那读起来像两种材质而不是两种层级。
  it('has a single blur radius and a single glow colour', () => {
    expect(Object.keys(glass).filter(key => key === 'blur')).toHaveLength(1)
    expect(typeof glass.blur).toBe('string')
    expect(typeof glow).toBe('string')
    expect(glow).toMatch(/^rgb\(/)
  })
})

describe('tokensCss', () => {
  // ★ 官网能用这一档，**完全**取决于它不含元素选择器：它跑在 VitePress 的默认主题上，
  //   一个 `*` 或 `body` 就足以打散那里的排版。
  it('contains no element selectors, only :root', () => {
    const text = tokensCss()

    expect(text.startsWith(':root {')).toBe(true)
    for (const forbidden of ['html', 'body', '*', ':where(*)']) {
      expect(text.includes(forbidden), `tokens 档不该出现 ${forbidden}`).toBe(false)
    }
  })

  it('declares every variable', () => {
    const text = tokensCss()
    for (const name of Object.keys(cssVariables())) {
      expect(text).toContain(`${name}:`)
    }
  })
})
