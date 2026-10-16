/**
 * 设计 token —— **这个包，以及整个产品的样式，只有这一份真相源**。
 *
 * # 为什么是数据，不是一串 CSS
 *
 * 同一组值要出现在三个地方，而它们的消费者不同：
 *
 * - **UnoCSS 的 `theme`**：生成 `bg-surface` / `text-ink-dim` 这样的工具类（`./unocss`）；
 * - **CSS 变量**：`var(--synra-surface)`，给不写工具类的地方、以及内联的反闪屏那一小段（`./css`）；
 * - **别的 UI 系统**：VitePress 的品牌变量、将来的某个组件库（各自一个子路径）。
 *
 * 如果这三处各写一遍，"改一支紫"就变成一次三处对齐的手工操作，而漏掉一处不会报错 ——
 * 只会让某个界面比别处旧一点。所以它们是**从这里算出来的**：
 *
 * ```
 * colors ──┬──► theme.colors（值是 var(...)，见 ./unocss 里的说明）
 *          └──► :root { --synra-surface: … }（cssVariables()）
 * ```
 *
 * # 命名
 *
 * 变量一律 `--synra-*`。不带前缀的 `--border` 与任何第三方 CSS 变量都是必然碰撞，
 * 而症状是"某个面板偶尔变透明"。（设计文档 28 §3 R7）
 *
 * # 色相只有一个
 *
 * 中性色全部偏紫。**一处蓝灰就足够把"一块材料"拆成两种材质** —— 那是这套"暗紫 + 毛玻璃"
 * 最容易犯的错，所以底色取自偏紫的近黑，而不是某个模板的 `#0f1115`。
 *
 * # 为什么没有间距刻度
 *
 * 间距用 UnoCSS 自带的数值刻度（`p-4` = 1rem）。自建一套的后果不是"更统一"，而是**同屏出现两种
 * 4px 的倍数**：一处用 `p-4`，另一处用 `p-[14px]`，而它们看起来都在遵守规范。
 */

/** 颜色。键名即工具类名与变量名：`surface` → `bg-surface` / `--synra-surface`。 */
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
  inkDim: '#a89dc6',
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

/** 圆角**分层**：控件 / 面 / 胶囊。三个值必须能一眼分开，否则等于没有层级。 */
export const radius = {
  control: '8px',
  surface: '12px',
  pill: '999px',
} as const

/** 层级。宿主主文档里的浮层互相盖是唯一一类"看起来对、就是点不到"的 bug，所以用名字不用数字。 */
export const zIndex = {
  base: 0,
  panel: 10,
  overlay: 20,
  modal: 30,
  toast: 40,
  drag: 50,
} as const

/** 时长。字面 `300ms` 不许出现在源码里，否则"整体调慢一点"是一次全仓搜索。 */
export const duration = {
  fast: '120ms',
  base: '180ms',
  slow: '280ms',
} as const

export const ease = {
  standard: 'cubic-bezier(0.32, 0.72, 0, 1)',
} as const

/**
 * 字族：一个超家族两个角色（SIL OFL 1.1，免费商用、允许插件作者随包再分发）。
 *
 * ★ IBM Plex **没有中日韩字形**，而界面自称双语（见 `synra-app` 的 `index.html`）。
 * 所以 sans 栈在 Plex 之后按平台列出 CJK 回退族，并且**不打包任何 CJK 字体**：
 * 一套 CJK 字体几十 MB，而它只需要出现在回退里。
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

/**
 * 断点用**标准数值**，不发明自己的名字与数字。
 *
 * 插件作者是第三方，`md: 768` 是他们的肌肉记忆；发明一套自定义断点会让每个人在第一次写响应式时
 * 踩一次坑。而每一档"做什么"必须写死（见设计文档 28 §4 R11 的表），那才是这条规则要立的东西。
 *
 * 宿主的最小窗口是 1024（`tauri.conf.json` 的 `minWidth`），与 `lg` 相等 —— 于是"任何用户能拖到的
 * 尺寸"都落在某个设计过的档位上。
 */
export const breakpoints = {
  'sm': '640px',
  'md': '768px',
  'lg': '1024px',
  'xl': '1280px',
  '2xl': '1536px',
} as const

/**
 * 主题约定。
 *
 * v1 **只有深色**，所以 token 本身就是深色的值，`color-scheme` 也是 `dark` ——
 * 写着 `light dark` 而只有一套深色值，是一句自相矛盾的话。
 *
 * 将来要做亮色时，它是**一次独立的设计**（不是把深色取反）：加一段 `.light` 覆盖，不改名。
 */
export const themeConvention = {
  /** 变量所在的层。`html.dark` 是同一套约定，VitePress 用的也是它。 */
  selector: ':root',
  colorScheme: 'dark',
  /** 将来那套亮色覆盖要用的类名；现在没有任何地方加它。 */
  futureLightClass: 'light',
} as const

/**
 * 对比度守卫要算的**成对**声明。
 *
 * 每一条都是"这个前景色会出现在那个背景色上"，而 `minimum` 是 WCAG 的门槛：正文 4.5，大字与
 * 控件 3。玻璃面上的文字算在它的**基底**上（`glassBase`），不算在模糊结果上。
 */
export interface ContrastPair {
  readonly foreground: keyof typeof colors | 'glassBase'
  /** `glassBase` 也是一种背景：玻璃面上的文字算在它的不透明基底上。 */
  readonly background: keyof typeof colors | 'glassBase'
  readonly minimum: number
  readonly use: string
}

export const contrastPairs: readonly ContrastPair[] = [
  { foreground: 'ink', background: 'screen', minimum: 4.5, use: '正文 / 页面底' },
  { foreground: 'ink', background: 'surface', minimum: 4.5, use: '正文 / 面板' },
  { foreground: 'ink', background: 'raised', minimum: 4.5, use: '正文 / 抬起层' },
  { foreground: 'inkDim', background: 'screen', minimum: 4.5, use: '次要文字 / 页面底' },
  { foreground: 'inkDim', background: 'surface', minimum: 4.5, use: '次要文字 / 面板' },
  { foreground: 'inkDim', background: 'raised', minimum: 4.5, use: '次要文字 / 抬起层' },
  { foreground: 'inkDim', background: 'glassBase', minimum: 4.5, use: '次要文字 / 玻璃面（按基底算）' },
  { foreground: 'primaryInk', background: 'screen', minimum: 4.5, use: '链接 / 页面底' },
  { foreground: 'primaryInk', background: 'raised', minimum: 4.5, use: '链接 / 抬起层' },
  { foreground: 'primary', background: 'screen', minimum: 3, use: '主色填充与光晕 / 页面底' },
  { foreground: 'primary', background: 'raised', minimum: 3, use: '主色填充与光晕 / 抬起层' },
  { foreground: 'lineStrong', background: 'raised', minimum: 3, use: '控件边界' },
  { foreground: 'ok', background: 'screen', minimum: 4.5, use: '状态 / 页面底' },
  { foreground: 'warn', background: 'screen', minimum: 4.5, use: '状态 / 页面底' },
  { foreground: 'danger', background: 'screen', minimum: 4.5, use: '状态 / 页面底' },
  { foreground: 'offline', background: 'screen', minimum: 4.5, use: '状态 / 页面底' },
]

/** `camelCase` → `kebab-case`，变量名与键名之间的唯一转换。 */
function kebab(key: string): string {
  return key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
}

/**
 * 全部 CSS 变量，名字 → 值。
 *
 * 颜色是**遍历**出来的，所以"变量名集合 == 颜色键集合"不是靠人工对齐，而是结构上成立 ——
 * 加一个颜色就自动多一个变量。（守卫见设计文档 28 §13.2 第 1 条）
 */
export function cssVariables(): Record<string, string> {
  const variables: Record<string, string> = {}

  for (const [key, value] of Object.entries(colors)) {
    variables[`--synra-${kebab(key)}`] = value
  }

  variables['--synra-glass'] = glass.color
  variables['--synra-glass-base'] = glass.base
  variables['--synra-blur'] = glass.blur
  // ★ 饱和度也成为一个变量，理由是它**出现在两处**：UnoCSS 的 `floating` shortcut 与
  //   `@synra/theme/antd` 那段给浮起层的 CSS。写两遍 140% 就是两处会漂移的取值（R6/R46）。
  variables['--synra-saturate'] = glass.saturate
  variables['--synra-glow'] = glow
  variables['--synra-focus-ring'] = focusRing

  for (const [key, value] of Object.entries(fontFamily)) {
    variables[`--synra-font-${kebab(key)}`] = value
  }

  for (const [key, value] of Object.entries(radius)) {
    variables[`--synra-radius-${kebab(key)}`] = value
  }
  for (const [key, value] of Object.entries(zIndex)) {
    variables[`--synra-z-${kebab(key)}`] = String(value)
  }
  for (const [key, value] of Object.entries(duration)) {
    variables[`--synra-duration-${kebab(key)}`] = value
  }
  for (const [key, value] of Object.entries(ease)) {
    variables[`--synra-ease-${kebab(key)}`] = value
  }

  return variables
}
