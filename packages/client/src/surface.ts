/**
 * 注入对象的形状。
 *
 * # 这是"给作者的视图"，不是宿主注入的原始形状
 *
 * 有几处**刻意**与运行时不同，每一处都有理由：
 *
 * | 运行时 | 这里 | 为什么 |
 * | --- | --- | --- |
 * | `env` 是一组属性 | `env` 是一组**方法** | 宿主侧是 IPC 代理，方法能明确"这是一次调用" |
 * | 只有 `event.subscribe` | 额外有 `device.onChange` | 合并去重的逻辑要有地方放，而它属于宿主 |
 * | `fetch` 返回原生 `Response` | 返回 `SynraResponse` | 见 `http.ts` |
 * | `self.invoke` 返回 `unknown` | 泛型 `<Args, Result>` | 作者按 `ActionDescriptor` 断言 |
 *
 * # 零运行时
 *
 * 这个文件里没有一个值：全是 `interface`、`type` 与 `declare`。所以它编译出的 `.d.ts` 之外
 * 没有任何东西，装进插件也不会进产物。
 *
 * 代价是**便捷判定函数必须由宿主提供**（`isSynraError` 等）—— 它们需要函数体。这一点是有意的：
 * 运行时只有宿主一个提供者，让它实现最简单，而这条决定了本包能始终保持零运行时。
 */

import type { DeviceId, PluginId, RequestId, TransferId } from '@synra/protocol'

import type { SynraFetchInit, SynraResponse } from './http'

// ─────────────────────────────────────────────────────────────────────────────
// 渐进增强
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 宿主**可能**实现、也可能没实现的客户端方法。
 *
 * 存在的理由：一个"预留但未实现"的能力需要一个自述机制，否则作者只能靠"调用失败再看错误"来
 * 探测 —— 体验差，而且日志里全是预期内的失败。
 */
export type ClientFeature
  = | 'device.onChange'
    | 'device.pick'
    | 'transfer.onProgress'
    | 'event.subscribe'
    | 'network.fetch'
    | 'clipboard.read'

/** 宿主平台支持的能力。**不是**插件被授予的能力。 */
export type PlatformCapability
  = | 'open_url'
    | 'open_path'
    | 'reveal_path'
    | 'simulate_keys'
    | 'notify'
    | 'clipboard_read'
    | 'clipboard_write'

// ─────────────────────────────────────────────────────────────────────────────
// 错误
// ─────────────────────────────────────────────────────────────────────────────

export type {
  NetworkErrorCode,
  SuggestedAction,
  SynraError,
  ErrorCode as SynraErrorCode,
} from '@synra/protocol'

// ─────────────────────────────────────────────────────────────────────────────
// 各 namespace
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Which engine renders a plugin page.
 *
 * ★ Progressive enhancement only. The design's rule is that a page must work on the weakest engine it supports; this is
 * for the places where a nicer effect is optional, never for whether the page functions at all. A plugin that treats
 * `unknown` as "modern" is a plugin that will break on the next engine.
 */
export type WebviewKind = 'webview2' | 'wkwebview' | 'webkitgtk' | 'android-webview' | 'unknown'

/** The engine, and its version when the user agent reports one. */
export interface WebviewInfo {
  /** Which engine. */
  kind: WebviewKind
  /**
   * The engine version, or `null` when the engine does not put one in the user agent.
   *
   * ★ `null` rather than a guess. WebKitGTK, for instance, reports an `AppleWebKit/…` token that is the WebKit version
   * rather than the GTK engine's, and calling that "the version" would make a comparison against a minimum silently
   * wrong.
   */
  version: string | null
}

/**
 * 环境信息与两个"能不能"。
 *
 * ★ 三个"能不能"的语义**不同**，混用会让按钮的禁用条件写错：
 *
 * 1. `can(capability)` —— 本插件**被授予**了吗？决定"我要不要走这条路"。
 * 2. `platformSupports(capability)` —— 宿主**平台**支持吗？决定"按钮要不要禁用"。
 * 3. `hostSupports(feature)` —— 宿主**版本**实现了吗？决定"要不要用这个 API"。
 *
 * 一个能力可能被授予而平台不支持（用户在 iOS 上批准了按键模拟），也可能平台支持而没被授予。
 * 两种情况界面上要说不同的话。
 */
export interface EnvNamespace {
  /** 宿主形态。 */
  hostKind(): 'desktop' | 'mobile'
  /** 操作系统。 */
  platform(): 'windows' | 'macos' | 'linux' | 'android' | 'ios'
  /** 用户的语言标签，形如 `zh-CN`。 */
  locale(): string
  /** 用户是否选了深色主题。 */
  darkMode(): boolean
  /** 宿主应用版本。 */
  appVersion(): string
  /** 插件 SDK 版本。 */
  sdkVersion(): string
  /** 渲染这个页面的 WebView 引擎，以及它报告的版本。只用于渐进增强。 */
  webview(): WebviewInfo
  /** 宿主**平台**是否支持该能力。与 `can()` 不是一回事。 */
  platformSupports(capability: PlatformCapability): boolean
  /** 宿主**版本**是否实现了某个客户端方法。同步，所以渲染时就能判断。 */
  hostSupports(feature: ClientFeature): boolean
  /** 本插件是否**被授予**该能力。参数是能力字符串，不是 `PlatformCapability`。 */
  can(capability: string): boolean
}

/** 日志。消息会经过内核的脱敏，所以不要把秘密拼进消息里。 */
export interface LogNamespace {
  trace(msg: string, ctx?: Record<string, unknown>): void
  debug(msg: string, ctx?: Record<string, unknown>): void
  info(msg: string, ctx?: Record<string, unknown>): void
  warn(msg: string, ctx?: Record<string, unknown>): void
  error(msg: string, ctx?: Record<string, unknown>): void
  /** 带固定前缀的子记录器，用于把一组消息归到一起。 */
  child(prefix: string): LogNamespace
}

/** 事件。 */
export interface EventNamespace {
  /**
   * 发一个事件。
   *
   * 事件名必须在插件自己的 `_plugin.<slug>.` 命名空间里，内核拒绝越权。
   */
  emit(event: string, payload?: unknown): Promise<void>
  /**
   * 订阅一个事件或模式。
   *
   * ★ **一定返回退订函数**。插件页面卸载时不退订会泄漏，而一个可能返回 `undefined` 的签名会让
   * 作者忘记处理那一支。
   */
  subscribe<T = unknown>(pattern: string, handler: (payload: T) => void): Unsubscribe
}

/** 设备。 */
export interface DeviceNamespace {
  /** 已配对且**在线**的设备。 */
  list(): Promise<DeviceTarget[]>
  /** 发给一台设备。 */
  send(req: { to: DeviceId, event: string, payload?: unknown }): Promise<void>
  /** 发给所有已配对且在线的设备。 */
  broadcast(req: { event: string, payload?: unknown }): Promise<void>
  /** 设备集合变化。宿主侧包了一层订阅与合并去重。 */
  onChange(handler: (devices: DeviceTarget[]) => void): Unsubscribe
  /**
   * 调起**宿主提供的选设备界面**。
   *
   * 为什么需要它：插件自己画一个选择器会与宿主的视觉和行为不一致；而且在"多台 PC"的场景下，
   * "这个按钮发给谁"是一个**用户决策**，不该由插件猜。
   *
   * 语义：
   * - 用户选中 → `resolve(deviceId)`
   * - 用户取消 → `resolve(null)`
   * - 宿主未实现 → `reject(SynraError{ code: 'unsupported' })`
   *
   * ★ 未实现时**也必须存在**这个方法。如果宿主返回的对象上缺了它，作者写
   * `synra.device.pick(...)` 会得到 `TypeError: not a function` —— 一个不可诊断的错误。
   * 保留方法并明确拒绝，让"这个宿主版本不支持"变成一个可处理的正常情况。
   */
  pick(options?: PickOptions): Promise<DeviceId | null>
  /** 宿主实现了哪些方法。**同步快照**，渲染时就能判断。 */
  readonly supported: readonly ClientFeature[]
}

/** 选设备的选项。 */
export interface PickOptions {
  readonly title?: string
  /** 只列出装了某插件的设备。 */
  readonly requiresPlugin?: PluginId
  /** 只列出具备某能力的设备。 */
  readonly requiresCapability?: string
}

/** 一台设备，给作者的视图。 */
export interface DeviceTarget {
  readonly deviceId: DeviceId
  readonly displayName: string
  readonly platform: 'windows' | 'macos' | 'linux' | 'android' | 'ios'
  readonly online: boolean
}

/**
 * 插件的键值存储。
 *
 * 与 headless 部分共用同一套 `storage` 能力，所以 UI 部分写进去的东西 headless 部分读得到 ——
 * 这是两者之间**唯一**能共享状态的方式。
 */
export interface StorageNamespace {
  /** 取值，缺省是 `undefined`。 */
  get<T = unknown>(key: string): Promise<T | undefined>
  /** 取值，缺省由调用方给，所以返回值**非可选**。 */
  get<T>(key: string, defaults: { fallback: T }): Promise<T>
  set<T = unknown>(key: string, value: T): Promise<void>
  delete(key: string): Promise<void>
  /** 列出键，可按前缀过滤。 */
  keys(prefix?: string): Promise<string[]>
  /** 用了多少、上限多少。 */
  quota(): Promise<{ usedBytes: number, maxBytes: number }>
}

/** 出网。 */
export interface NetworkNamespace {
  /**
   * 出网请求。
   *
   * ★ 这是**唯一**的出网路径。插件页面的 CSP 是 `connect-src 'none'`，所以直接 `fetch` 会失败，
   * 而那个失败在控制台里看起来像网络问题。
   */
  fetch(input: string, init?: SynraFetchInit): Promise<SynraResponse>
}

/** 传输。 */
export interface TransferNamespace {
  /** 发一个大对象。返回值用于查询进度与状态。 */
  send(req: {
    to: DeviceId
    file: Blob
    fileName: string
    /** 同一批传输共用的标识，接收方据此把它们归到一起。 */
    contextId?: string
  }): Promise<TransferId>
  status(id: TransferId): Promise<TransferStatus>
  /**
   * 订阅进度。
   *
   * ★ 与 `event.subscribe` 一样**一定返回退订函数**：进度回调挂在一次传输上，不退订的话传输
   * 结束后回调还会被调用。
   */
  onProgress(id: TransferId, handler: (progress: TransferProgress) => void): Unsubscribe
}

/** 一次传输的状态。 */
export interface TransferStatus {
  readonly transferId: TransferId
  readonly state:
    | 'pending'
    | 'offered'
    | 'accepted'
    | 'transferring'
    | 'paused'
    | 'verifying'
    | 'completed'
    | 'failed'
    | 'cancelled'
  readonly receivedBytes: number
  readonly totalBytes: number
  readonly error?: import('@synra/protocol').SynraError
}

/** 进度快照。与线上类型同名但这里是给作者用的视图。 */
export interface TransferProgress {
  readonly transferId: TransferId
  readonly state: TransferStatus['state']
  readonly receivedBytes: number
  readonly totalBytes: number
  /** 已完成的比例，`0` 到 `1`。总长为零时是 `0` 而不是 `NaN`。 */
  readonly ratio: number
}

/**
 * 平台能力。
 *
 * ★ **没有 `simulateKeys`，没有 `fs`。** UI 插件永远不能做这两件事：它跑在 WebView 里，没有
 * 沙箱隔离代码，所以给它按键模拟等于给页面任意按键。需要时经 `synra.self.invoke()` 交给本插件
 * 的 headless 部分 —— 那是唯一途径。
 */
export interface PlatformNamespace {
  openUrl(url: string): Promise<void>
  notify(req: { title: string, body: string }): Promise<void>
}

/** 剪贴板。 */
export interface ClipboardNamespace {
  read(): Promise<string>
  write(text: string): Promise<void>
}

/**
 * 本插件的 headless 部分。
 *
 * ★ 这是 UI 拿到高危能力的**唯一**途径。按键模拟必须由 headless 做，因为 Wasm 沙箱提供了
 * WebView 没有的隔离。
 */
export interface SelfNamespace {
  /** 调本插件 headless 部分声明的 action。 */
  invoke<Args = unknown, Result = unknown>(action: string, args?: Args): Promise<Result>
  /** 列出本插件 headless 声明了哪些 action，用于动态渲染按钮。 */
  actions(): Promise<ActionDescriptor[]>
}

/** 一个 action 的声明。 */
export interface ActionDescriptor {
  readonly name: string
  readonly description?: string
  /** 参数的 JSON Schema。 */
  readonly args?: unknown
  /** 返回值的 JSON Schema。 */
  readonly returns?: unknown
}

// ─────────────────────────────────────────────────────────────────────────────
// 客户端
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 宿主注入的 Synra 客户端。
 *
 * 插件 UI 上下文里**必然存在**；宿主自己的界面里不存在（宿主走 Tauri command，不用这个对象）。
 */
export interface SynraClient {
  readonly env: EnvNamespace
  readonly log: LogNamespace
  readonly event: EventNamespace
  readonly device: DeviceNamespace
  readonly storage: StorageNamespace
  readonly network: NetworkNamespace
  readonly transfer: TransferNamespace
  readonly platform: PlatformNamespace
  readonly clipboard: ClipboardNamespace
  readonly self: SelfNamespace

  /**
   * 判定一个值是不是 `SynraError`。
   *
   * 需要函数体，所以实现在宿主侧。类型在这里声明，于是作者能拿到收窄后的类型。
   */
  isSynraError(value: unknown): value is import('@synra/protocol').SynraError
  /** 判定是不是某个具体的错误码，用于 `if (synra.isCode(e, 'capability_denied'))`。 */
  isCode(value: unknown, code: import('@synra/protocol').ErrorCode): boolean
  /**
   * 判定一次失败是不是"能力被拒"。
   *
   * ★ 与 `isCode(e, 'capability_denied')` 是同一件事，但收窄得更准：收窄到
   * `code: 'capability_denied'` 的字面量，所以 `catch` 里的分支能直接读到那个码，
   * 而不必再断言一次。它不是 `isCode` 的别名 —— 一个返回 `boolean` 的函数
   * 无法让 TypeScript 在分支里收窄类型，而那正是作者写 `if` 时想要的。
   *
   * 设计文档 §4.1 列了它，而实现里一直没有：文档 §5.2 和 §8 的示例都在用它，
   * 所以作者照着抄会得到一个不存在的方法。
   */
  isCapabilityDenied(value: unknown): value is import('@synra/protocol').SynraError & { code: 'capability_denied' }
  /**
   * 告诉宿主"页面已挂载完成"。
   *
   * 同步且对调用方无副作用：宿主的加载态切换与超时判定靠它，而页面不需要等待回答。
   */
  ready(): void
  /**
   * 一个请求标识，用于把自己的多次调用归到一起。
   *
   * 由宿主生成而不是 `crypto.randomUUID()`：标识要进内核的去重表，而内核要能确认它是随机的。
   */
  requestId(): RequestId
}

/** 一次事件订阅的退订函数。 */
export type Unsubscribe = () => void
