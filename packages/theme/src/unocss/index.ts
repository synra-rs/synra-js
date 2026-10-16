/**
 * `@synra/theme/unocss` —— 宿主界面与插件界面共用的 UnoCSS 配置。
 *
 * 这是这个包里**唯一**允许 import `unocss` 的一层：包根保持零依赖，所以官网（只要颜色）与
 * 内联反闪屏（只要一段 CSS）都不必为 UnoCSS 付一次装包与体积。
 *
 * ```ts
 * // uno.config.ts
 * import { defineConfig } from 'unocss'
 * import { synraConfig } from '@synra/theme/unocss'
 *
 * export default defineConfig({ ...synraConfig() })          // 宿主 / 插件
 * export default defineConfig({ ...synraConfig({ preflight: 'tokens' }) })  // 官网
 * ```
 *
 * 想自己写配置、只借这几块也可以：`presetSynra` / `synraTheme` / `synraBlocklist` /
 * `structuralShortcuts` 都是单独导出的。
 */

export { synraConfig } from './config.js'
export type { SynraConfigOptions } from './config.js'

export { presetSynra, synraTheme, synraThemeColors } from './preset.js'
export type { SynraPresetOptions } from './preset.js'

export { synraBlocklist } from './blocklist.js'
export type { Blocklist } from './blocklist.js'

export { structuralShortcuts } from './shortcuts.js'
