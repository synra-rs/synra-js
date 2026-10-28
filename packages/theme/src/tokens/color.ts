/**
 * 颜色。键名即工具类名与变量名：`surface` → `bg-surface` / `--synra-surface`。
 *
 * # 色相只有一个
 *
 * 中性色全部偏紫。**一处蓝灰就足够把"一块材料"拆成两种材质** —— 那是这套"暗紫 + 毛玻璃"
 * 最容易犯的错，所以底色取自偏紫的近黑，而不是某个模板的 `#0f1115`。
 *
 * # 为什么半透明是算出来的
 *
 * `withAlpha` 在这里，是因为它只被用来从一支颜色推出一个半透明的形态：`--synra-glow` 手写成
 * `rgb(124 92 255 / 45%)` 时，它和 `colors.primary` 之间的那层关系只存在于人的记忆里 ——
 * 换一支紫，光晕会**静默地**还是旧的那一支，而两者在暗底上都很像。
 */
export const colors = {
  /** 页面底：最深的一层，取自官网那块"设备屏幕"。 */
  screen: '#0b0813',
  /** 面板：抬起一层。 */
  surface: '#14101f',
  /** 再抬一层，也是毛玻璃的**不透明基底**（见 `glass`）。 */
  raised: '#1c1630',
  /** 分隔线。**纯装饰**——对比度只有 1.22:1，不够当控件边界，所以另有一个 strong。 */
  line: '#2e2547',
  /** 控件边界（输入框边缘、聚焦目标）。暗底上要 3:1 就必须这么亮。 */
  lineStrong: '#8b7ab8',
  /** 正文。 */
  ink: '#ece7f8',
  /** 次要文字。 */
  inkDim: '#8c82a6',
  /** 主色，用于**填充、发光、图形**。4.57:1 —— 过控件线，不过正文线，所以不用于小字。 */
  primary: '#7c5cff',
  /** 主色作为**文字**（链接、强调）。这就是"一支暗紫读不了正文"的直接后果：主色是两个角色。 */
  primaryInk: '#b9a5ff',
  /** 主色的深端：按下态，以及**官网亮色主题里的主色文字**（白底 6.72:1）。 */
  primaryDeep: '#5b3fd6',
  ok: '#5fd6a8',
  warn: '#e8b055',
  danger: '#ff7676',
  /** 离线：不是"警告"，是"不在这里"，所以它是一支中性灰而不是第四种语义色。 */
  offline: '#8b93a5',
} as const

/**
 * `#rrggbb` + 百分比 → `rgb(r g b / p%)`。
 *
 * ★ 有这个函数是因为半透明的形态**必须是算出来的**：`--synra-glow` 手写成
 * `rgb(124 92 255 / 45%)` 时，它和 `colors.primary` 之间的那层关系只存在于人的记忆里 ——
 * 换一支紫，光晕会**静默地**还是旧的那一支，而两者在暗底上都很像。
 */
export function withAlpha(hex: string, percent: number): string {
  const digits = hex.replace('#', '')
  const channels = [0, 2, 4].map(at => Number.parseInt(digits.slice(at, at + 2), 16))
  return `rgb(${channels.join(' ')} / ${String(percent)}%)`
}
