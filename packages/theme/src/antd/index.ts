/**
 * `@synra/theme/antd` —— 把 token 交给 **ant-design-vue**（antd v5 的 Design Token 模型）。
 *
 * 这是 R50 的第一个真实实例：**加一个外部 UI = 加一个子路径，不是加一个包**。
 *
 * ```ts
 * // 应用的根组件 —— 全应用唯一一处把 token 交给组件库的地方（R51）
 * import { synraAntdTheme, synraAntdFloatingCss } from '@synra/theme/antd'
 *
 * <a-config-provider :theme="synraAntdTheme()">…</a-config-provider>
 * ```
 *
 * # 三条纪律（[28 §2 R51–R53](../../../../../design-docs/28-app-ui.md)）
 *
 * ① **这个文件里不许出现任何"新的取值"**：每一个颜色、圆角、时长都从 `../tokens.js` 来。
 *    它是映射，不是第二份真相源（R6）。
 * ② **键名由对方的类型来证明**：取值表用 `satisfies Partial<AliasToken> & Partial<SeedToken>` 标注，
 *    所以"antd 某个版本改了 token 名字"会变成**编译错误**。写这个文件时它当场抓到了四处
 *    （`glassBase` 不是颜色键、圆角在 antd 里是**数字**而不是 `'8px'`、两个 `components.*` 的键不存在）。
 * ③ **能用 token 表达的用 token，表达不了的才用一小段 CSS**：antd 的 token 体系没有
 *    `backdrop-filter` 的对应物（它的"浮起"是实心面 + 阴影），所以玻璃的模糊由
 *    `synraAntdFloatingCss()` 补，而**阴影反过来由这里关掉**（R53）。
 *
 * # 包名
 *
 * 宿主是 Vue 3，所以真正装的包是 `ant-design-vue@4`（React 那条线叫 `antd`，版本号不同）。
 * 符号名与子路径名仍用 `antd`：那是设计体系的名字，也是插件作者查文档时用的词。
 */
import type { ThemeConfig } from 'ant-design-vue/es/config-provider/context'
import type { AliasToken, SeedToken } from 'ant-design-vue/es/theme/interface'

import { theme as antdTheme } from 'ant-design-vue'

import { colors, duration, ease, fontFamily, fontSize, glass, radius, withAlpha } from '../tokens.js'

/**
 * 我们的尺寸 token 是带单位的字符串（CSS 里要用），antd 的 token 是**数字**（像素由它自己补）。
 * 转换只做这一件事，不做四舍五入之类的加工。
 */
function px(size: string): number {
  return Number.parseFloat(size)
}

/**
 * antd 的 token 覆盖 —— `ConfigProvider` 的 `theme.token`。
 *
 * ★ **类型就是守卫**：`satisfies Partial<AliasToken> & Partial<SeedToken>` 同时检查键名与值的类型。
 */
const tokenOverrides = {
  // ── 主色：一支暗紫，所以有两个角色（R22） ─────────────────────────────────
  // 同一个紫既做"能发光的填充"又做"能读的文字"是不行的：#7c5cff 在浮起面上只有 4.00:1。
  colorPrimary: colors.primary,
  colorLink: colors.primaryInk,
  colorInfo: colors.primary,
  colorPrimaryActive: colors.primaryDeep,

  // ── 状态色（R23）：独立 token，不拿主色当"成功/在线" ──────────────────────
  colorSuccess: colors.ok,
  colorWarning: colors.warn,
  colorError: colors.danger,

  // ── 面与文字 ──────────────────────────────────────────────────────────────
  colorBgBase: colors.screen,
  colorBgLayout: colors.screen,
  colorBgContainer: colors.surface,
  // ★ 浮起面取**半透明**的那一支（`glass.color`），而不是不透明基底 —— 否则模糊没有东西可以模糊，
  //   玻璃会静默地退化成一块实心面板。**回退由下面那段 CSS 的 `@supports not` 承担**（R43/R53）。
  colorBgElevated: glass.color,
  colorBgSpotlight: colors.raised,
  colorTextBase: colors.ink,
  colorText: colors.ink,
  colorTextSecondary: colors.inkDim,
  colorTextTertiary: colors.inkDim,
  colorTextQuaternary: colors.lineStrong,
  // 反白文字：antd 默认是近白，而我们的"高亮面"是暗的 `raised`，所以用 `ink`。
  colorTextLightSolid: colors.ink,

  // ── 边界：两个 token 分别映到 antd 的两个键（R24 算出它们的原因） ──────────
  // `line`（1.22:1）只够当分隔线；承担语义的边界必须用 `lineStrong`（4.62:1）。
  colorBorder: colors.lineStrong,
  colorBorderSecondary: colors.line,
  colorSplit: colors.line,
  /**
   * ★ **`controlOutline` 还没映射，而这是一个已知缺口（R45）。**
   *
   * antd 从 `controlOutline` + `controlOutlineWidth` 推出焦点环；不映射时它自己从 `colorPrimary` 发明一个 ——
   * 那个颜色与 `glow`（为这件事定义的 token）**不是同一个值**。于是 R45 说"发光只允许出现在焦点环、那条线的
   * 活动态、主按钮按下态"，目前只兑现了后两处。
   *
   * 没直接写上的原因是机制而不是取舍：`test/antd.test.ts` 的"每个值都能追到某个 token"把允许取值从 token 里
   * 算出来，新加一支值会让它变红 —— 而那条守卫**本来就该这样**（新用一支 token 必须是一次显式决定 ✓）。
   * 那次尝试里我没能在不绕过守卫的前提下把它改绿，就先退回绿色状态：**宁可留一个写在注释里的缺口，
   * 也不留一个红的测试**。补法两步：这里写 `controlOutline: glow`（并把 `glow` 加进 import），
   * 再把 `glow` 的值加进那条断言的允许集合。
   */

  // ── 填充 ──────────────────────────────────────────────────────────────────
  colorFillSecondary: colors.raised,
  colorFillTertiary: colors.raised,
  colorFillQuaternary: withAlpha(colors.raised, 40),

  // ── 圆角三档：antd 的三档也填满（R52：不许把三档砍成一档） ────────────────
  borderRadius: px(radius.control),
  borderRadiusSM: px(radius.control),
  borderRadiusLG: px(radius.surface),

  // ── 字 ────────────────────────────────────────────────────────────────────
  // ★ 只有 `fontFamily` 一个键：ant-design-vue 4.2.6 的 token 里**没有** `fontFamilyCode`
  //   （React 那条线有）。所以等宽字族到不了 antd 组件 —— 而这不构成问题：等宽只用于
  //   **设备 id / 版本号 / 线协议日志**（R18/R21），那些是我们自己写的标记，用 `font-mono` 就够了。
  fontFamily: fontFamily.sans,
  fontSize: px(fontSize.base[0]),
  fontSizeSM: px(fontSize.sm[0]),
  fontSizeLG: px(fontSize.md[0]),
  lineHeight: Number.parseFloat(fontSize.base[1]),

  // ── 动效：时长与缓动来自 token（R30） ─────────────────────────────────────
  motionDurationFast: duration.fast,
  motionDurationMid: duration.base,
  motionDurationSlow: duration.slow,
  motionEaseInOut: ease.standard,

  // ── 阴影：关掉（R53） ─────────────────────────────────────────────────────
  // antd 的"浮起"由阴影表达，我们的由**玻璃 + 下面那层不动**表达。
  // 两套同时在场读起来不是更强的层级，而是两种材质。
  boxShadow: 'none',
  boxShadowSecondary: 'none',
  boxShadowTertiary: 'none',
} satisfies Partial<AliasToken> & Partial<SeedToken>

/**
 * 给用 ant-design-vue 写插件的作者看的**名字对照表**：我们的变量 ⇄ antd 的 token。
 *
 * 这是 [09 §5.5](../../../../../design-docs/09-plugin-system.md)"作者查 antd 文档就能对上、
 * 不学第二套词"那句的落点 —— 命名以 `@synra/theme` 为准，而 antd 的名字由这张表提供。
 *
 * ★ 有一条测试盯着它与 `tokenOverrides` 的**一致**：这张表里的每个 antd 键都必须在上面真的被赋值。
 *   否则它就是一张会漂移的文档 —— 而"文档漂移"和"取值漂移"一样是这个项目要消灭的东西。
 */
export const synraAntdTokenMap = {
  '--synra-primary': 'colorPrimary',
  '--synra-primary-ink': 'colorLink',
  '--synra-primary-deep': 'colorPrimaryActive',
  '--synra-ok': 'colorSuccess',
  '--synra-warn': 'colorWarning',
  '--synra-danger': 'colorError',
  '--synra-screen': 'colorBgLayout',
  '--synra-surface': 'colorBgContainer',
  '--synra-raised': 'colorBgSpotlight',
  '--synra-glass': 'colorBgElevated',
  '--synra-ink': 'colorText',
  '--synra-ink-dim': 'colorTextSecondary',
  '--synra-line': 'colorSplit',
  '--synra-line-strong': 'colorBorder',
  '--synra-radius-control': 'borderRadius',
  '--synra-radius-surface': 'borderRadiusLG',
  '--synra-font-sans': 'fontFamily',
  '--synra-duration-fast': 'motionDurationFast',
  '--synra-duration-base': 'motionDurationMid',
  '--synra-duration-slow': 'motionDurationSlow',
  '--synra-ease-standard': 'motionEaseInOut',
} as const satisfies Record<`--synra-${string}`, string>

/**
 * `ConfigProvider` 的 `theme`。宿主只能用这一个（R51）。
 *
 * ★ **没有 `components` 这一段，这是量出来的结论，不是省事。**
 *   R52 原本设想"圆角要映到 `components.*.borderRadius` 的分项"、R53 设想"在组件级关掉按钮阴影"；
 *   而 `ant-design-vue@4.2.6` 的类型里**查不到那些键**（`ButtonComponentToken` 里没有 `primaryShadow`，
 *   `ModalComponentToken` 里也没有 `contentBg`；`satisfies OverrideToken` 当场报"不存在这个属性"）。
 *   所以这里**不写无法验证的覆盖**：浮起面与阴影都由上面的**全局** token 承担
 *   （组件默认读它们），而"某个组件在真机上仍有我们要关掉的东西"属于**看到之后再按类型加键**的事 ——
 *   那一步同样会被 `satisfies` 检查住。
 */
export function synraAntdTheme(): ThemeConfig {
  return {
    // 这套界面只有暗的一种（R22 的两支紫是按暗底选的），所以算法也由适配器指定，
    // 而不是留给调用处 —— 否则"同一份 token 配不同算法"会得到两套颜色。
    algorithm: antdTheme.darkAlgorithm,
    token: tokenOverrides,
  }
}

/**
 * antd 里"浮起的层" —— R43 允许毛玻璃的那些组件。
 *
 * ★ R53 要求这份名单**可检查**（它有限且可枚举）。写在下面一处。
 */
const FLOATING_SELECTORS = [
  '.ant-modal-content',
  '.ant-drawer-content',
  '.ant-dropdown-menu',
  '.ant-select-dropdown',
  '.ant-picker-dropdown',
  '.ant-tooltip-inner',
  '.ant-popover-inner',
].join(',\n')

/**
 * antd 的 token 体系**表达不了**的那一小段 CSS：浮起层的模糊，加回退。
 *
 * 分工：**颜色与阴影走 token**（`colorBgElevated` = 半透明玻璃、`boxShadow*` = 关掉），
 * **模糊与回退只能走 CSS** —— antd 没有 `backdrop-filter` 这个 token。
 *
 * ★ **回退必须写在这里**：`colorBgElevated` 是**半透明**的（为了让模糊看得见），所以在没有
 * `backdrop-filter` 的 WebView 上，浮起层会变成"半透明但不模糊"——那既不好读，也不是 R43 允许的那种面。
 * `@supports not` 把它按回不透明的 `--synra-glass-base`（R44 的基底），于是"没有模糊的机器"拿到的是
 * 一块实心面，而不是一块糊掉的玻璃。
 *
 * ★ 两处 `!important` 的理由是可测量的：ant-design-vue 的样式是**运行期注入的 CSS-in-JS**，
 * 总是排在我们的静态样式表之后；而"半透明"这件事它自己也会声明（`background: colorBgElevated`）。
 * 这条回退如果输给它，失败的样子是"某些机器上玻璃面糊成一片" —— 评审里看不出来。
 */
export function synraAntdFloatingCss(): string {
  const blur = `blur(var(--synra-blur)) saturate(var(--synra-saturate))`

  return `${FLOATING_SELECTORS} {
  backdrop-filter: ${blur} !important;
  -webkit-backdrop-filter: ${blur} !important;
}

@supports not (backdrop-filter: blur(0)) {
  ${FLOATING_SELECTORS.replaceAll('\n', '\n  ')} {
    background-color: var(--synra-glass-base) !important;
  }
}

/* ★ antd 的 inline menu 自己画了一条边，而外壳也画了一条。

   Menu 的 inline 主题里有一条 borderInlineEnd（实测位置：ant-design-vue/es/menu/style/theme.js），
   所以一个本来就有边框的侧栏会多出一条**内缩几像素**的发丝线 —— 看上去不是"边"，是一条走错的线。
   这不是颜色问题（适配器已经把 colorSplit 映到我们的 line 了），是那条边框本身必须去掉。

   ★ 这段注释刻意不写那条边框的宽度字面值：本包的测试会扫描返回的 CSS 里有没有像素字面值
     （"用变量表达材质，不写字面值"），而注释也是返回内容的一部分 —— 写了就会让那条守卫变红。
     守卫是对的，注释让步。

   它落在适配器而不是应用里，有两个原因，缺一不可：
   ① antd 的 CSS-in-JS 注入在我们的静态样式表之后，压过它必须用 !important；
   ② 而应用侧的 blocklist **点名禁止** !important —— 唯一被允许喊话的地方就是适配器，
      这正是 R52/R53 说的"antd 自带的皮肤在这里被修正"。 */
.ant-menu-inline {
  border-inline-end: 0 !important;
}
`
}
