/* eslint-disable */
/**
 * ⚠️ 自动生成，请勿手动修改。
 *
 * 来源：synra-core/crates/synra-ipc/src/dto.rs
 * 生成：cargo test -p synra-ipc --features ts-export
 * 同步：pnpm --filter @synra/protocol sync
 *
 * 宿主界面看到的形状。每个都是**纯数据**：没有句柄、没有连接、没有插件实例。界面持有的是一幅内核
 * 当前所信之事的**图画**，需要新的时再要一张。
 *
 * ★ 这些字段都是 `camelCase`。命名大小写不是风格问题：名字写错大小写会以 `undefined` 到达，而那
 * 种失败的表现是"插件列表是空的"而任何地方都没有报错。
 */


/** 本机身份。 */
export interface IdentitySnapshot {
  readonly deviceId: string
  readonly displayName: string
  readonly platform: string
  readonly kernelVersion: string
  /**
   * 名字是用户起的还是生成的。
   *
   * 报告出来是因为生成的名字是用户可能想改的，界面据此决定要不要提示。
   */
  readonly nameIsDefault: boolean
}

/** 一次传输的紧凑形式，挂在设备卡片上。 */
export interface TransferSummary {
  readonly transferId: string
  readonly direction: string
  /** `0` 到 `1`。 */
  readonly progress: number
}

/** 设备列表里的一张卡片。 */
export interface DeviceCard {
  readonly deviceId: string
  readonly displayName: string
  readonly platform: string
  readonly online: boolean
  /**
   * 是否**已配对**，与是否在线不是一回事。
   *
   * 分开是因为它们回答不同的问题：配对但离线的设备是用户稍后还能发的，在线但未配对的设备是用户得先
   * 配对的。
   */
  readonly paired: boolean
  readonly blocked: boolean
  readonly lastSeenMs: number
  /** 最后可达的地址。只在未配对时给出 —— 地址是用户认出"这台我还没配对的机器"的方式。 */
  readonly address?: string
  readonly transfer?: TransferSummary
}

/** 发现扫描的进度。 */
export interface ScanState {
  readonly scanId: string
  readonly elapsedMs: number
  readonly totalMs: number
  readonly found: number
}

/** 等待决定的配对请求。 */
export interface PairingPrompt {
  readonly requestId: string
  readonly deviceId: string
  readonly displayName: string
  readonly platform: string
  readonly address: string
  /**
   * 两侧显示的校验码，供用户比对。
   *
   * 提示的全部意义所在：这个比对是阻止同网段另一台设备冒名配对的东西。
   */
  readonly verificationCode: string
  readonly expiresAtMs: number
}

/** 一个意图可能被怎么处理。 */
export interface IntentCandidate {
  readonly pluginId: string
  readonly title: string
  readonly deviceId: string
  readonly online: boolean
}

/** 用户在被告知什么。 */
export interface IntentPrompt {
  readonly message: string
  readonly params: unknown
  readonly options: readonly string[]
}

/** 一个意图走到了哪里。 */
export interface IntentSnapshot {
  readonly intentId: string
  readonly state: string
  readonly pluginId?: string
  readonly candidates: readonly IntentCandidate[]
  readonly prompt?: IntentPrompt
  readonly error?: unknown
  readonly startedAtMs: number
}

/** 一次传输，作为列表里的一行。 */
export interface TransferSnapshot {
  readonly transferId: string
  readonly peerDevice: string
  readonly peerName: string
  readonly direction: string
  readonly kind: string
  readonly state: string
  readonly fileName: string
  readonly receivedBytes: number
  readonly totalBytes: number
  readonly blocksDone: number
  readonly blocksTotal: number
  readonly abortReason?: string
  readonly startedAtMs: number
}

/** 插件的健康度，用于设计文档要求的透明度。 */
export interface PluginHealthDto {
  readonly health: string
  readonly explanation: string
  readonly callsAdmitted: number
  readonly callsRefused: number
  readonly usage: unknown
}

/** 一个可用的更新。 */
export interface UpdateInfo {
  readonly version: string
  /**
   * 它的 manifest 是否要了当前版本没要的东西。
   *
   * 界面据此说"这个更新想要一个新权限"而不是"有更新" —— 后者是例行消息，前者是一个决定。
   */
  readonly needsNewConsent: boolean
  readonly addedCapabilities: readonly string[]
}

/** 一个插件，作为列表里的一张卡片。 */
export interface PluginSnapshot {
  readonly pluginId: string
  readonly title: string
  readonly description?: string
  readonly version: string
  readonly publisher: string
  readonly enabled: boolean
  /**
   * 它在生命周期的哪里。
   *
   * 界面显示这个而不是从 `enabled` 加健康度**推导**：一个已启用但 faulted 的插件是必须告诉用户的
   * 状态，在界面里推导意味着同一条规则有两份实现。
   */
  readonly state: string
  readonly hybrid: boolean
  readonly health?: PluginHealthDto
  readonly granted: readonly string[]
  readonly denied: readonly string[]
  readonly update?: UpdateInfo
}