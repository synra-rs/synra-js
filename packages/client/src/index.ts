/**
 * `@synra/client` —— 插件 UI 拿到的注入对象的**类型**。
 *
 * # 零运行时
 *
 * 包里没有值。所以：
 *
 * - 装进插件不会进产物；
 * - 不能 `import { anything }` 取值，只能 `import type`；
 * - 包体积是几个 `.d.ts` 的大小。
 *
 * # `types: ["@synra/client"]` 开箱即用
 *
 * 这一条是包形态的核心要求：作者在 `tsconfig.json` 里写
 *
 * ```jsonc
 * { "compilerOptions": { "types": ["@synra/client"] } }
 * ```
 *
 * 就该拿到全局的 `synra`、`window.synra` 与 `Unsubscribe`，不需要额外的 `include`、不需要
 * triple-slash 指令。做到这一点靠的是 `global.d.ts` 里的 `declare global`，且它必须被
 * **入口的声明文件**引到 —— 所以下面那一行 `import './global'` 是必需的，不是装饰。
 */

// ★ 这一行是必需的：它把 `declare global` 拉进本包的声明文件，于是 `types: ["@synra/client"]`
//   能拿到全局声明。删掉它，全局 `synra` 就只在显式 import 本包时可见。
import './global'

export type {
  // 注入对象
  SynraClient,
  Unsubscribe,
  // 环境与能力
  EnvNamespace,
  ClientFeature,
  PlatformCapability,
  // 各 namespace
  LogNamespace,
  EventNamespace,
  DeviceNamespace,
  PickOptions,
  DeviceTarget,
  StorageNamespace,
  NetworkNamespace,
  TransferNamespace,
  TransferStatus,
  TransferProgress,
  PlatformNamespace,
  ClipboardNamespace,
  SelfNamespace,
  ActionDescriptor,
} from './surface'

// 出网形状来自 `http.ts` —— 它是两侧共同的形状契约，所以从那里导出而不是经 `surface`。
export type {
  SynraFetchInit,
  SynraFetchMethod,
  SynraResponse,
  SynraFetchErrorCode,
} from './http'

export type {
  SynraError,
  ErrorCode as SynraErrorCode,
  NetworkErrorCode,
  SuggestedAction,
} from '@synra/protocol'