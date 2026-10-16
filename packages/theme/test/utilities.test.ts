/**
 * 每个 token 都必须产出它承诺的那个工具类。
 *
 * ★ **这条守卫是发现真 bug 之后补的。** `synraTheme()` 原来把时长与缓动映射到
 * `transitionDuration` / `transitionTimingFunction`，而 `@unocss/preset-mini@66` 的规则读的是
 * `theme.duration[key]` 与 `theme.easing[key]` —— 于是 `duration-base` 与 `ease-standard`
 * **静默不生成**（UnoCSS 对不认识的类不报错，只是什么都不产出）。宿主要按时长 token 写过渡时
 * 才会发现，而那时的症状是"每个组件自己写字面 `150ms`"，看起来像是没遵守约定而不是配置错了。
 *
 * 判据故意是**"这个类名有没有产出 CSS"**，而不是"theme 里有没有这个键"：键名与 UnoCSS 的读法对不上时，
 * 前者会红而后者照样绿 —— 后者正是那次失败的样子。
 *
 * 这里刻意**不含图标类**：图标要 `@iconify-json/*` 数据集，而本包没有（R41 把数据集留给消费者）。
 */
import { createGenerator } from 'unocss'
import { describe, expect, it } from 'vitest'

import { synraConfig } from '../src/unocss/index.js'

/** 一份"消费者真的会写"的清单：每个 token 至少一种用法。 */
const utilities = [
  // 颜色：面子、文字、边界
  'bg-screen',
  'bg-surface',
  'bg-raised',
  'bg-glass',
  'text-ink',
  'text-ink-dim',
  'text-primary',
  'text-primary-ink',
  'text-danger',
  'text-ok',
  'text-warn',
  'border-line',
  'border-line-strong',
  // 圆角三档（R9：控件 / 面 / 胶囊）
  'rounded-control',
  'rounded-surface',
  'rounded-pill',
  // 层级（R9：禁止裸 z-index）
  'z-panel',
  'z-overlay',
  'z-modal',
  'z-toast',
  // 时长与缓动（R30：禁止字面 ms 与 ease-in-out）
  'duration-fast',
  'duration-base',
  'duration-slow',
  'ease-standard',
  'transition',
  // 材质（R44/R46：一个模糊半径）
  'backdrop-blur-synra',
  // 字族与字号阶梯（R18/R20）
  'font-sans',
  'font-mono',
  'text-xs',
  'text-sm',
  'text-base',
  'text-lg',
  'text-xl',
  'text-2xl',
  // 结构性 shortcuts（R3）
  'screen',
  'panel',
  'floating',
  'focusable',
  'stack',
  'row',
  'row-between',
]

const uno = await createGenerator(synraConfig())

describe('每个 token 都产出它承诺的工具类', () => {
  it.each(utilities)('%s 会生成 CSS', async (name) => {
    const { css } = await uno.generate(name, { preflights: false })

    expect(css.trim().length).toBeGreaterThan(0)
  })
})

describe('禁用名单是活的（负控制）', () => {
  it.each([
    'uppercase',
    'ml-4',
    'text-[#fff]',
    'z-[99]',
  ])('%s 什么都不生成', async (name) => {
    const { css } = await uno.generate(name, { preflights: false })

    expect(css.trim()).toBe('')
  })
})
