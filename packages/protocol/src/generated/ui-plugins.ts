/** Plugin DTOs from synra-ipc/src/dto/plugin.rs; empty skipped arrays are optional. */
/** 插件健康度，用于设计文档要求的透明度。 */
export interface PluginHealthDto {
  readonly health: string
  /** 一句解释。它是句子，不是消息键：配额层的 `explain` 返回的是稳定 crate 的散文。 */
  readonly explanation: string
  readonly callsAdmitted: number
  readonly callsRefused: number
  readonly usage: unknown
}

/** 一个可用的更新。 */
export interface UpdateInfo {
  /** 这条更新属于哪个插件。 */
  readonly pluginId: string
  readonly version: string
  /**
   * 它的 manifest 是否要了当前版本没要的东西。
   *
   * 界面据此说"这个更新想要一个新权限"而不是"有更新" —— 后者是例行消息，前者是一个决定。
   */
  readonly needsNewConsent: boolean
  readonly addedCapabilities?: readonly string[]
}

/** 一个插件，作为列表里的一张卡片。 */
export interface PluginSnapshot {
  readonly pluginId: string
  /**
   * 这个插件自己的数据目录。
   *
   * ★ 一个路径而不是布尔值：卸载对话框有两个结果，其中一个会删掉这个目录，所以用户在同意之前有权看见它。
   * 壳用 `Paths::plugin_sandbox_dir` 构造它 —— 与卸载本身同一个函数，否则“数据在哪”会有两个答案。
   */
  readonly dataPath: string
  readonly title: string
  readonly description?: string
  readonly version: string
  readonly localSource: boolean
  readonly publisher: string
  readonly enabled: boolean
  /**
   * 它在生命周期的哪里。
   *
   * 界面显示这个而不是从 `enabled` 加健康度**推导**：一个已启用但 faulted 的插件是必须告诉用户的
   * 状态，在界面里推导意味着同一条规则有两份实现。
   */
  readonly state: string
  /**
   * 它为什么没有在运行，当状态词说不出原因时。
   *
   * ★ 状态词说的是**什么**（`unavailable`/`unreadable`），这里说的是**为什么**，用的是做决定的层自己的句子。
   * 安全模式是催生这个字段的场景：崩溃循环之后宿主决定一个插件都不启动，所有插件都是 `unavailable`，
   * 而只被告知 `unavailable` 的用户会去找一个坏插件，而不是去看那段崩溃。
   */
  readonly stateReason?: string
  readonly hybrid: boolean
  /**
   * 它是否有一页自己的界面。
   *
   * ★ 与 `hybrid` 不是同一件事：只有 UI 的插件有页面、没有 headless 半，而打开它正是 `plugin_ui_open` 能做的事。
   * 卡片需要这两个事实**分开**，否则唯一"有页面但没有 Wasm"的形态会没有入口。
   */
  readonly hasUi: boolean
  readonly health?: PluginHealthDto
  readonly granted: readonly string[]
  /**
   * 插件**声明**的能力，无论用户是否已经决定。
   *
   * ★ 为什么不能从 `granted` + `denied` 推导：用户回答之前两者都是空的，而同意提示要问的正是"这些"。
   * 没有它，界面只能提供"全部允许"—— 那恰恰是逐项同意存在的理由。
   */
  readonly requested?: readonly string[]
  readonly denied?: readonly string[]
  readonly update?: UpdateInfo
  /** Last successful check of this installed version, as epoch milliseconds. */
  readonly updateCheckedAtMs?: number
}

/** 一个本机见过其签名的发布者。 */
export interface PublisherDto {
  /** 发布者自己的标识，来自它的签名。 */
  readonly publisherId: string
  /** 钥匙指纹，按人读的方式分组。 */
  readonly fingerprint: string
  /** `seen`、`trusted` 或 `revoked`。 */
  readonly trust: string
  /** 第一次见到这个钥匙的签名是什么时候。 */
  readonly firstSeenMs: number
  /** 用户做过决定的话，是什么时候。 */
  readonly decidedMs?: number
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

/** 目录结果的排序方式；只有搜索端点能兑现的两种。 */
export type CatalogSort = 'relevance' | 'name'

/** 目录搜索。 */
export interface CatalogQuery {
  /** 搜索词。 */
  readonly query: string
  /** 用哪个源，用户配了多个的时候。 */
  readonly registry?: string
  /** 最多几条。内核会截断。 */
  readonly limit?: number
  /** 跳过几条，用于翻页。 */
  readonly offset?: number
  /** 结果顺序：`relevance` 是 registry 自己的顺序，`name` 按名称排。 */
  readonly sort?: CatalogSort
}

/** 一个 registry 包在下载任何字节之前会装成什么。 */
export interface InstallPreviewDto {
  readonly pluginId: string
  readonly version: string
  readonly title: string
  readonly description?: string
  readonly publisher: string
  readonly publisherName?: string
  /**
   * 静态目录声称的发布者钥匙指纹。
   *
   * ★ 是目录的**声明**，不是验证：签名在下载下来的字节上校验，这个字段给确认框第二份可对照的说法。
   */
  readonly publisherKey?: string
  /** 它要求被允许什么，按 manifest 的拼写。 */
  readonly capabilities: readonly string[]
  /** 是否没有界面也能跑。 */
  readonly headless: boolean
  /** 是否给界面加页面。 */
  readonly hasUi: boolean
  /** 发布者声称的体积，字节。 */
  readonly sizeBytes?: number
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

/** 一次安装做了什么。 */
export interface InstallReport {
  /** 现在装上了的插件。 */
  readonly pluginId: string
  /** 落盘的那个版本。 */
  readonly version: string
  /** 通过但带警告的检查，句子形式，界面可以直接显示。 */
  readonly warnings?: readonly string[]
  /** 是否已启用。从安装返回时**总是** `false`：装不等于批准。 */
  readonly enabled: boolean
  /** 签名包的真实签名者，没有签名时缺失。 */
  readonly publisherId?: string
  /** 签名公钥的指纹，没有签名时缺失。 */
  readonly fingerprint?: string
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
