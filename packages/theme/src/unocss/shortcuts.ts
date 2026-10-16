/**
 * 结构性 shortcuts —— 只有**结构原语**，没有成品视觉组件。
 *
 * # 为什么没有 `card` / `btn` / `badge`
 *
 * 因为一旦 preset 里有 `card`，所有消费者都会长成同一张卡 —— 那是把"统一"做成了"撞脸"。
 * 这套东西该管的是"不许漂移"，不是"够不够独特"：独特性来自少数一次性决策（配色、那一个记忆点），
 * 不来自组件的复刻。
 *
 * 判据：一个 shortcut 配得上留在这里，当且仅当它描述的是**结构与行为**（这是一个浮起的层、
 * 这是一行、这是焦点环），而不是"这东西长什么样"。
 *
 * # `floating` 为什么算结构
 *
 * 因为它说的正是"这是一个浮起的层"—— 而"哪些层可以是毛玻璃"是这套设计里的一条**规则**
 * （只有浮起的层），把这条规则变成一个名字，比在每个对话框上手写四个类要可靠。
 */

import type { Preset } from 'unocss'

/** 结构原语。`Preset.shortcuts` 接受的名字 → 工具类。 */
export const structuralShortcuts: NonNullable<Preset['shortcuts']> = {
  /** 应用/页面的外壳：占满视口高度、底色、字色、字族。`dvh` 而不是 `vh`：软键盘弹出时后者会被顶出去。 */
  'screen': 'min-h-dvh bg-screen text-ink font-sans',

  'stack': 'flex flex-col',
  'row': 'flex items-center',
  'row-between': 'flex items-center justify-between',

  /** 一块不透明的面。它**不是**卡：没有阴影、没有 hover，只有一层底色和一条边。 */
  'panel': 'bg-surface border border-line rounded-surface',

  /** 浮起的层：毛玻璃 + 一条边 + 焦点相关的层级交给调用方。 */
  'floating': 'bg-glass backdrop-blur-synra backdrop-saturate-140 border border-line rounded-surface',

  /**
   * 焦点环。
   *
   * 不能省：`outline-none` 而没有替代，是这套界面里最容易犯的可访问性错误。
   * 两圈（先底色再主色）是为了让环在任何底色上都切得出来。
   *
   * ★ **它原来叫 `focus-ring`，而那个名字是坏的**：UnoCSS 把 `focus-ring` 解析成
   * **`focus` 变体 + `ring` 工具类**（`.focus-ring:focus{--un-ring-width:3px}`），于是
   * shortcut 被静默遮蔽 —— 生成的是 `:focus`（鼠标点一下也亮环）而不是 `:focus-visible`，
   * 而那个名字看起来完全正常。**短路名字不许以变体名加连字符开头。**
   */
  'focusable': 'outline-none focus-visible:ring-2 focus-visible:ring-primary-ink focus-visible:ring-offset-2 focus-visible:ring-offset-screen',
}
