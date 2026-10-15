/* eslint-disable */
/**
 * 宿主界面看到的形状 —— **手写镜像，由脚本核对**。
 *
 * 来源：synra-rust-core/crates/synra-ipc/src/dto/*.rs
 * 核对：synra-rust-app/scripts/check-shapes.ts 的 `dto-coverage` 检查
 *
 * ★ 这个文件曾经声称是自动生成的，并给出 `cargo test -p synra-ipc --features ts-export` 这条命令。
 * 那条命令不存在：synra-ipc 没有 `[features]` 段，`ts_export.rs` 只生成 `ErrorCode` 和
 * `SuggestedAction` 两个联合类型，**不生成这个文件**。声明是手写的。
 *
 * 为什么这件事值得写下来而不是顺手改掉：一份声称自动生成的文件会告诉下一个读它的人"不用查"。
 * 而这里最要命的失效恰好是静默的 —— Rust 里改了字段名，TS 侧收到 `undefined`，表现是面板空白
 * 而不是编译错误。除了这一段说明，`dto-coverage` 检查现在会在两边对不上时失败，所以这份镜像
 * 是**被核对的**，而不是**自称是被生成的**。
 *
 * ★ 字段都是 `camelCase`。命名大小写不是风格问题：名字写错大小写会以 `undefined` 到达，而那种
 * 失败的表现是"插件列表是空的"而任何地方都没有报错。
 *
 * ★ `Option` 和带 `skip_serializing_if` 的字段一律写成可选。Rust 那边省略的是"没有值"，而
 * `undefined` 是"字段没到" —— 两者在 TS 里只能都写成可选，这一点让接口无法区分它们，
 * 所以命令的返回类型都把这一点写在各自的文档里。
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

/**
 * 设备页的一次完整回答。
 *
 * ★ 与 Rust 的 `DevicesSnapshot` 逐字段对应：字段名是 `devices` 而不是 `cards`，而 `scanning` 是**进行中的扫描**
 * 本身（`ScanState`）而不是一个布尔值。手写镜像在这两处都会写错 —— 一个 `cards` 会以 `undefined` 到达（列表
 * 空白、无任何报错），而一个布尔 `scanning` 会丢掉扫描进度，界面于是只能显示"正在扫描"而说不出扫到哪一步。
 */
export interface DevicesSnapshot {
  /** 本机，免得界面再发一次请求。 */
  readonly identity: IdentitySnapshot
  /** 全部设备，已配对的在前。 */
  readonly devices: readonly DeviceCard[]
  /** 正在进行的扫描，没有就是没有。 */
  readonly scanning?: ScanState
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

/** 配置的当前状态。 */
export interface ConfigSnapshot {
  /**
   * 每一条设置，按点分路径。
   *
   * ★ 不是一个"每个设置一个字段"的结构。
   *
   * 配置会随每个特性增长，而结构体意味着每加一个设置就要发一次接口版本 —— 所以边界上带的是整袋，
   * 由**界面**拥有自己的形状。代价是这个包里没有字段名可供检查，代价换来的是界面与内核可以各自演进。
   */
  readonly values: unknown
  /** 哪些键来自文件而不是默认值，界面据此标记。 */
  readonly overridden: readonly string[]
}

/** 配置的一次改动。 */
export interface ConfigPatch {
  /** 要设的键。 */
  readonly set?: Readonly<Record<string, unknown>>
  /** 要删的键，回到默认值。 */
  readonly unset?: readonly string[]
}

/** 发现扫描的选项。 */
export interface ScanOptions {
  /** 扫多久，毫秒。内核会按自己的预算截断。 */
  readonly timeoutMs?: number
  /** 是否包含已经配对的设备。 */
  readonly includePaired: boolean
  /**
   * 是否完全不用网络，只看本机已有的记录。
   *
   * 一个"把我知道的都给我看"的模式，给离线的设备用：界面不必花扫描预算就能列出已配对的设备。
   */
  readonly cachedOnly: boolean
}

/** 目录里的一条搜索结果。 */
export interface CatalogItem {
  readonly pluginId: string
  readonly title: string
  readonly description?: string
  /** 提供的版本。 */
  readonly version: string
  /** 谁发布的。 */
  readonly publisher: string
  /**
   * 它要多少项能力。
   *
   * 是一个数而不是列表：目录的答复是一次搜索结果，而带着每个插件完整权限列表的搜索结果是线上最大的
   * 东西，用来换最少被读的部分。
   */
  readonly capabilityCount: number
  readonly installed: boolean
}

/** 目录搜索。 */
export interface CatalogQuery {
  /** 搜索词。 */
  readonly query: string
  /** 用哪个源，用户配了多个的时候。 */
  readonly registry?: string
  /** 最多几条。内核会截断。 */
  readonly limit?: number
}

/** 移除插件时选了什么。 */
export interface RemoveOptionsDto {
  /**
   * 是否连数据和沙箱一起删。
   *
   * 分两步而不是一步，因为这是两个不同的决定：移除一个用户可能还会装回来的插件应当保留它的设置，
   * 而移除一个用户不信任的插件就不该保留。
   */
  readonly removeData: boolean
}

/** 移除做了什么。 */
export interface RemoveReport {
  /** 释放了多少字节。 */
  readonly bytesFreed: number
  /** 数据是否留下了。 */
  readonly dataKept: boolean
  /** 没能移除的部分。 */
  readonly leftovers?: readonly string[]
}

/** 同步计划里的一个目标设备。 */
export interface SyncTarget {
  readonly deviceId: string
  readonly displayName: string
  /** 是否需要送产物。 */
  readonly needsArtifact: boolean
  /** 它已经有的版本。 */
  readonly version?: string
  /** 现在够得着吗。 */
  readonly online: boolean
}

/** 一次同步的计划。 */
export interface SyncPlanDto {
  readonly pluginId: string
  /** 它要去哪些设备，以及各自需要什么。 */
  readonly targets: readonly SyncTarget[]
}

/** 同步失败的一个设备。 */
export interface SyncFailure {
  readonly deviceId: string
  /** 为什么。 */
  readonly error: unknown
}

/** 一次同步的结果。 */
export interface SyncReport {
  /** 更新了多少台。 */
  readonly updated: number
  /** 多少台本来就是新的。 */
  readonly unchanged: number
  /** 失败的设备及原因。 */
  readonly failures?: readonly SyncFailure[]
}

/** 一次能力检查的审计条目。 */
export interface AuditEntryDto {
  /** 什么时候。 */
  readonly atMs: number
  /** 试的是什么。 */
  readonly capability: string
  /** 放行了吗。 */
  readonly allowed: boolean
  /** 不放行的理由。 */
  readonly reason?: string
  /** 这次调用花了多久。 */
  readonly elapsedMs?: number
  /** 属于哪条追踪。 */
  readonly traceId?: string
}

/** 发一段文本。 */
export interface SendTextRequest {
  /** 发给谁。 */
  readonly to: string
  /** 文本。 */
  readonly text: string
  /** 落成的文件叫什么。 */
  readonly fileName: string
  /** 把这次发送归到一段对话或一个意图下的不透明标识。 */
  readonly contextId?: string
}

/** 发一个文件。 */
export interface SendFileRequest {
  /** 发给谁。 */
  readonly to: string
  /** 路径，界面拿到时的样子。 */
  readonly path: string
  /** 把这个文件归到一段对话或一个意图下的不透明标识。 */
  readonly contextId?: string
}

/** 导出诊断包时用户同意了什么。 */
export interface DiagExportOptions {
  /**
   * 是否包含审计轨迹。默认关，因为它会说出用户装了哪些插件。
   */
  readonly includeAudit: boolean
  /**
   * 是否包含调试级别的日志行。默认关，因为它们最可能带上用户没打算分享的东西。
   */
  readonly includeDebugLogs: boolean
  /** 带多少行日志。 */
  readonly logLines?: number
}