/**
 * `@synra/theme` —— 宿主界面、插件界面、官网共用的样式真相源。
 *
 * # 为什么是一个包，而不是"三个地方各写一遍同样的颜色"
 *
 * 因为**宿主与插件之间没有运行时联系**：插件页是一个独立文档、独立 origin、`connect-src 'none'`。
 * 宿主无法给插件页加样式，插件也无法从宿主继承变量。唯一能共享的就是**一份在各自构建期被读进去的
 * token**。
 *
 * # 为什么包名是 theme 而不是 ui
 *
 * 因为这个包里**没有组件，而且不许有**。而在前端生态里 `ui` 就等于"组件库" —— 那是第三方插件作者
 * 看到 `ui` 之后第一件会去找的东西，也是一个名字做出的、这个包交付不了的承诺。
 * **`theme` = token 与配置，`ui` = 组件**，这已经是默认读法。
 *
 * # 四个入口，一个包
 *
 * | 入口 | 谁用 |
 * | - | - |
 * | `@synra/theme`（这里） | 任何东西。**零依赖**，只有数据与纯函数 |
 * | `@synra/theme/css` | 只要一段 CSS 文本的地方：内联的反闪屏、构建脚本 |
 * | `@synra/theme/unocss` | 宿主界面与插件界面（`unocss` 是 **optional peer**，见那里的说明） |
 * | `@synra/theme/vitepress` | 官网 |
 *
 * 以后要接一个新的 UI 系统（某组件库、某 CSS-in-JS），**加一个子路径，不加一个包**：
 * 每多一个包就多一次版本对齐、多一份依赖声明，而"同一套 token"会被拆成 N 份需要互相对齐的映射。
 *
 * # 这个入口为什么必须是零依赖
 *
 * 官网、内联反闪屏、以及任何"只要颜色不要工具类"的消费者都从这里取东西。**如果这里把 `unocss`
 * 拉了进来，每个非 UnoCSS 消费者都要为 UnoCSS 付一次装包与体积** —— 所以 `unocss` 只挂在
 * `./unocss` 子路径上，并且在 `package.json` 里是 `peerDependenciesMeta.optional`。
 */

export {
  breakpoints,
  colors,
  contrastPairs,
  cssVariables,
  duration,
  ease,
  focusRing,
  fontFamily,
  fontSize,
  fontWeight,
  glass,
  glow,
  radius,
  themeConvention,
  withAlpha,
  zIndex,
} from './tokens.js'

export type { ContrastPair } from './tokens.js'

export { css, resetCss, tokensCss } from './css.js'
export type { PreflightTier } from './css.js'
