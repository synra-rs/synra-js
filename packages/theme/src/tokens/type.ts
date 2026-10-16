/**
 * 字：字族、字重、字号阶梯。
 *
 * # 为什么字族要列 CJK 回退
 *
 * IBM Plex **没有中日韩字形**，而界面自称双语（见 `synra-app` 的 `index.html`）。所以 sans 栈在
 * Plex 之后按平台列出 CJK 回退族。
 *
 * # 为什么只带用到的字重
 *
 * 字体是每个插件产物都要下载一遍的成本。
 */

/**
 * 字族：一个超家族两个角色（SIL OFL 1.1，免费商用、允许插件作者随包再分发）。
 *
 * ★ 回退族**不打包任何 CJK 字体**：一套 CJK 字体几十 MB，而它只需要出现在回退里。
 */
export const fontFamily = {
  sans: '"IBM Plex Sans", "PingFang SC", "Microsoft YaHei UI", "Noto Sans CJK SC", ui-sans-serif, system-ui, sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
} as const

/** 只带用到的字重：字体是每个插件产物都要下载一遍的成本。 */
export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
} as const

/**
 * 字号阶梯，每档配死行高（UnoCSS 的 `fontSize` 收 `[size, lineHeight]`）。
 *
 * 低端更细（12/13/14），因为界面正文是 14px 而根字号保持 16px —— 不把根字号改成 14px 是为了
 * `rem` 语义还成立（跟随用户缩放与系统字号）。
 */
export const fontSize = {
  'xs': ['12px', '1.5'],
  'sm': ['13px', '1.55'],
  'base': ['14px', '1.55'],
  'md': ['16px', '1.5'],
  'lg': ['20px', '1.35'],
  'xl': ['26px', '1.25'],
  '2xl': ['34px', '1.15'],
} as const
