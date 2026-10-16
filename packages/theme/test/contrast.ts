/**
 * WCAG 对比度的计算，给几个测试共用。
 *
 * # 为什么它是共用的，而不是各测试里一份
 *
 * 因为它算出来的数字**是断言的一部分**：两份实现会允许两份门槛，而"哪个测试更严"取决于谁抄了哪一份。
 * 三处消费者（token 层、VitePress 映射、将来的某个 UI 系统）用同一份，才谈得上"一套门槛"。
 */

/** WCAG 相对亮度。 */
export function luminance(hex: string): number {
  const digits = hex.replace('#', '')
  const channels = [0, 2, 4].map(at => Number.parseInt(digits.slice(at, at + 2), 16) / 255)
  const [red = 0, green = 0, blue = 0] = channels.map(channel =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

/** WCAG 对比度，1:1 到 21:1。 */
export function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((left, right) => right - left)
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05)
}
