/**
 * 材质：毛玻璃、发光、焦点环。
 *
 * 这三样都是从颜色**算出来**的，所以它们在颜色之后 —— 换一支紫，它们跟着换，而不是各写一遍。
 */
import { colors, withAlpha } from './color.js'

/**
 * 毛玻璃。
 *
 * # 为什么它必须成对声明
 *
 * 玻璃让对比度变成"取决于后面是什么"，而对比度守卫只能算静态对。所以每个玻璃面都要有一个
 * **不透明基底** `base`，守卫拿它算；没有基底的玻璃等于没有对比度结论。（设计文档 28 §6 R44）
 *
 * `blur` 只有一个值：玻璃的"厚度"是材质，不是可调参数。要区分层级用面色的明度差，
 * 不要用模糊半径。（同 R46）
 */
export const glass = {
  color: withAlpha(colors.raised, 62),
  base: colors.raised,
  blur: '14px',
  saturate: '140%',
} as const

/** 发光。它表示"这里活着"，不是皮肤：只有焦点环、那条线的活动态、主按钮按下态三处用它。 */
export const glow = withAlpha(colors.primary, 45)

/** 焦点环：先一圈底色（把环从背景里切出来），再一圈主色。 */
export const focusRing = `0 0 0 2px ${colors.screen}, 0 0 0 4px ${colors.primaryInk}` as const
