/* eslint-disable */
/**
 * 宿主界面看到的形状 —— **手写镜像，由脚本核对**。
 *
 * 来源：synra-rust-core/crates/synra-ipc/src/dto/*.rs，外加 `synra-observe/src/metrics`（指标快照）
 * 核对：synra-js/scripts/check-shapes.ts 的 `dto-coverage` 检查
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
/** 一个 IPC 拒绝：稳定的 code、可翻译的 message key，以及可选的参数与建议动作。 */
import type { SuggestedAction } from './wire'

export interface IpcError {
  readonly code: string
  readonly message: string
  readonly params?: unknown
  readonly details?: unknown
  readonly retryable: boolean
  readonly actions?: readonly SuggestedAction[]
}

export interface IntentSnapshot {
  readonly intentId: string
  /**
   * 这次动作所有步骤共同的 trace。
   *
   * ★ 板一直带着它，快照却把它丢了 —— 用户唯一能粘进 `synra logs --trace` 的标识，界面反而看不见。
   */
  readonly traceId: string
  readonly state: string
  readonly pluginId?: string
  readonly candidates: readonly IntentCandidate[]
  readonly prompt?: IntentPrompt
  readonly error?: IpcError
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

/**
 * 已经落在收件箱里的一个文件。
 *
 * ★ 与在飞的 `TransferSnapshot` 不是一回事：传输结束后行就没了，文件还在。它从 inbox 目录读，而不是从表里读——
 * 表活过文件会让用户去打开一个不存在的路径。
 */
export interface ReceivedFile {
  /** 落盘时的名字。 */
  readonly fileName: string
  /** 落点，用户可以据此打开它。 */
  readonly path: string
  /** 字节数。 */
  readonly bytes: number
  /** 最后写入时刻，epoch 毫秒。 */
  readonly receivedAtMs: number
}

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

/**
 * 诊断包写到了哪里，以及它装了什么。
 *
 * `included` 与 `excluded` 是同意页要读回来的那两半：只给一个路径的话，用户没法在把文件发出去之前看到里面有什么。
 */
export interface DiagExportResult {
  /** 写出的文件。 */
  readonly path: string
  /** 它包含的章节。 */
  readonly included: readonly string[]
  /** 被略过的章节与原因。 */
  readonly excluded: readonly string[]
}

/**
 * 一次启动探针的结果。
 *
 * `status` 是字符串（`ok`/`warn`/`fail`）而不是观察 crate 的枚举：这是边界，一个复用枚举的 DTO 会为一格字段把
 * `synra-observe` 拖进契约镜像。
 */
export interface ProbeResultDto {
  /** 稳定的机器可读名字，例如 `tcp_port_available`。 */
  readonly name: string
  /** `ok`、`warn` 或 `fail`。 */
  readonly status: string
  /** 发现了什么。 */
  readonly detail: string
  /** 可以做什么，若有。 */
  readonly suggestion?: string
}

/** 宿主跑过的全部探针，按运行顺序。 */
export interface ProbeReportDto {
  /** 结果。 */
  readonly results: readonly ProbeResultDto[]
}

// ── 指标（`diag_metrics` 的答案）────────────────────────────────────────────
//
// ★ 这一组的来源是 `synra-observe` 的 `metrics` 目录，不是 `synra-ipc` 的 DTO：`diag_metrics` 把记录器的快照
// 原样过线。`scripts/check-shapes.ts` 的 `dto-coverage` 因此把那个目录也纳入扫描，否则下面几个 interface 会被
// 报成"没有同名 Rust struct"，而一项总在报警的检查等于没有检查。

/**
 * 一个直方图的累计分布。
 *
 * `bounds[i]` 是第 `i` 个桶的上界，`buckets[i]` 是落进去的观测数；最后一个桶没有上界
 * （Rust 那边渲染成 `f64::INFINITY`，这里不发明一个数字）。
 */
export interface HistogramSnapshot {
  /** 上界，升序。 */
  readonly bounds: readonly number[]
  /** 每个上界一个计数，另加一个开区间的顶桶。 */
  readonly buckets: readonly number[]
  /** 观测次数。 */
  readonly count: number
  /** 观测值之和。 */
  readonly sum: number
}

/** 指标的身份：名字与标签对。JSON 里标签是 `[key, value]` 二元数组，已按 key 排序。 */
export interface SeriesKey {
  /** 指标名。 */
  readonly name: string
  /** 标签对。 */
  readonly labels: readonly (readonly [string, string])[]
}

/**
 * 一条指标的值。
 *
 * ★ 带 tag 的联合而不是一个数字：100 次调用与一段 100 毫秒的直方图在数字上可以相同，而读的人需要知道
 * 自己看的是哪一个。tag 与内核 `Value` 的 serde 形状一致（`kind` + `value`）。
 */
export type MetricValue =
  | { readonly kind: 'counter', readonly value: number }
  | { readonly kind: 'gauge', readonly value: number }
  | { readonly kind: 'histogram', readonly value: HistogramSnapshot }

/** 一条序列：键与值。 */
export interface SeriesValue {
  /** 指标身份。 */
  readonly key: SeriesKey
  /** 它的值。 */
  readonly value: MetricValue
}

/** 一个记录器的全部状态。 */
export interface MetricsSnapshot {
  /** 全部序列，按渲染后的键排序。 */
  readonly values: readonly SeriesValue[]
  /** 有多少次观测被折进了 overflow 序列。 */
  readonly overflowedTotal: number
  /** 生效的每指标序列上限，读的人据此判断快照是否完整。 */
  readonly maxSeriesPerMetric: number
}

/**
 * 一次崩溃，来自 `synra_observe::crash::CrashReport`。
 *
 * ★ 与 `MetricsSnapshot` 一样直接镜像 observe 的类型，而不是在 `synra-ipc` 里再包一层：它是诊断数据，
 * 没有要稳定的边界形状，多一层 DTO 只会多一个要同步的副本。
 */
export interface CrashReport {
  /** 崩溃发生的时刻（epoch 毫秒）。 */
  readonly atMs: number
  /** 崩溃时的应用版本。 */
  readonly version: string
  /** `file:line:column`，安全模式按它计重复次数；没有位置的报告不参与计数。 */
  readonly location?: string
  /** panic 的消息，若它是字符串。 */
  readonly message?: string
  /** 线程名，若有。 */
  readonly thread?: string
  /** 捕获的 backtrace。 */
  readonly backtrace?: string
  /** 崩溃时正在进行的 trace；维护者据此在日志里找步骤。 */
  readonly traceId?: string
}