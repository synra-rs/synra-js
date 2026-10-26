/* eslint-disable */
/**
 * ⚠️ **手写镜像，由脚本核对** —— 不是自动生成的。
 *
 * 来源：synra-rust-core/crates/synra-protocol/src
 * 核对：synra-js/scripts/check-shapes.ts
 *
 * ★ 这里曾经写着"自动生成，请勿手动修改"，并给出 `cargo test -p synra-protocol --features ts-export`
 * 这条命令。**那条命令跑不起来**：synra-protocol 没有 `[features]` 段，也没有 `ts_export` 模块，
 * 导出路径从来没有存在过。一个跑不起来的生成器比没有生成器更糟 —— 它让人以为不必再查，
 * 而这个文件里真正的失效是静默的：Rust 改了字段名，TS 侧收到 `undefined`，表现是面板空白。
 *

// ─────────────────────────────────────────────────────────────────────────────
// 帧（§4）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 帧类型。数字是**线上的值**，不是枚举序号。
 *
 * 从 `0x01` 开始而不是 `0x00`：零是未初始化的内存，一个读错的字节更可能变成零而不是别的值，
 * 所以把零留作非法值让"读错了"表现为拒绝而不是一条合法的信封帧。
 */
export const FrameKind = {
  /** 信封（UTF-8 JSON）。 */
  Envelope: 0x01,
  /** 二进制数据块。 */
  Chunk: 0x02,
  /** 心跳，body 为空。 */
  Ping: 0x03,
  Pong: 0x04,
  /** 建链握手。 */
  Hello: 0x05,
  HelloAck: 0x06,
  /** 主动关闭，body 是原因码加可选文本。 */
  Bye: 0x07,
} as const

export type FrameKind = (typeof FrameKind)[keyof typeof FrameKind]

/** 帧头长度（字节）：`u32` 长度 + `u8` 类型 + `u8` 标志。 */
export const FRAME_HEADER_LEN = 6

/** 一帧的上限，**含帧头**（1 MiB）。 */
export const MAX_FRAME_LEN = 1024 * 1024

/**
 * 一个数据块的上限（256 KiB）。
 *
 * 长度字段是 `u32` 而这里是 256 KiB，是因为一个块要能在一次读里被零拷贝地切出来 —— 更大的块
 * 会让接收端为了拿到完整的一块而缓存多轮读取。
 */
export const MAX_CHUNK_LEN = 256 * 1024

/** 一个 payload 的上限（256 KiB）。 */
export const MAX_PAYLOAD_LEN = 256 * 1024

/**
 * 长度字段**包含**类型与标志这两个字节，所以 body 的长度是 `length - 2`。
 *
 * 写成常量而不是留给调用方各自减，是因为这个 `- 2` 是帧格式里最容易写错的一处。
 */
export const FRAME_LENGTH_OVERHEAD = 2

// ─────────────────────────────────────────────────────────────────────────────
// 身份（§3）
// ─────────────────────────────────────────────────────────────────────────────

/** 本机设备标识，UUID v7 的字符串形式。 */
export type DeviceId = string

/** 插件标识，形如 `@scope/name`。 */
export type PluginId = string

/** 意图标识。 */
export type IntentId = string

/** 传输会话标识。 */
export type TransferId = string

/** 请求标识，用于去重。 */
export type RequestId = string

/** 事件名，形如 `device.ping` 或 `_synra.transfer.completed`。 */
export type EventName = string

/** 追踪标识，把一次操作在一台或两台设备上的日志串起来。 */
export type TraceId = string

// ─────────────────────────────────────────────────────────────────────────────
// 错误（§5.2、§7.6）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 机器可读的错误原因。**分支判断用这个，永远不要判断 `message`。**
 *
 * `snake_case`，与 Rust 侧的 `#[serde(rename_all = "snake_case")]` 一致。
 */
export type ErrorCode =
  | 'capability_denied'
  | 'plugin_not_installed'
  | 'device_offline'
  | 'not_paired'
  | 'transport_not_open'
  | 'transfer_failed'
  | 'integrity_mismatch'
  | 'payload_too_large'
  | 'timeout'
  | 'rate_limited'
  | 'unsupported'
  | 'invalid_argument'
  | 'scheme_not_allowed'
  | 'host_not_allowed'
  | 'ip_not_allowed'
  | 'redirect_blocked'
  | 'response_too_large'
  | 'protocol_violation'
  | 'protocol_version_unsupported'
  | 'plugin_trapped'
  | 'plugin_timeout'
  | 'internal'

/**
 * 出网专属的错误码，从 `ErrorCode` 里取出来的子集。
 *
 * 单独一个类型是因为内核的出网路径只产生这几个，而一个只处理 `network.fetch` 的
 * `switch` 拿到完整的 `ErrorCode` 就必须写一个永远走不到的 `default`。
 */
export type NetworkErrorCode =
  | 'scheme_not_allowed'
  | 'host_not_allowed'
  | 'ip_not_allowed'
  | 'redirect_blocked'
  | 'response_too_large'
  | 'timeout'

/**
 * 用户可执行的建议。界面据此渲染按钮，翻译层从不需要解析散文。
 *
 * 内部标签是 `kind`，所以判别不需要读别的字段。
 */
export type SuggestedAction =
  | { readonly kind: 'openSettings'; readonly section: string }
  | { readonly kind: 'requestCapability'; readonly capability: string }
  | { readonly kind: 'installPlugin'; readonly pluginId: string }
  | { readonly kind: 'connectDevice'; readonly deviceId: string }
  | { readonly kind: 'retry' }
  | { readonly kind: 'viewLogs'; readonly traceId: string }

/**
 * 一个结构化错误。
 *
 * ★ 字段是 `camelCase`，而 `code` 的**取值**是 `snake_case`。两套大小写出现在同一个结构里，
 * 所以拼接它们的地方要留心。
 */
export interface SynraError {
  /** 机器可读的原因。分支判断用这个。 */
  readonly code: ErrorCode
  /** 人能读的说明。**永远不要**对它做分支判断或匹配。 */
  readonly message: string
  /** 同样的操作是否可以原样重试。 */
  readonly retryable: boolean
  /** 用户能做的事，按优先级排序。为空时会被省略。 */
  readonly actions?: readonly SuggestedAction[]
  /** 失败操作的追踪标识，用来把报告与日志对上。 */
  readonly traceId?: string
  /** Structured diagnostic context; it cannot override the error classification. */
  readonly details?: unknown
}


// ─────────────────────────────────────────────────────────────────────────────
// 信封（§5）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 信封。每一个信封帧的 body 都是它的 JSON。
 *
 * `requestId`、`from`、`target` 与 `sentAtMs` 是**必填**的：缺一个的信封无法被去重、无法被
 * 路由、也无法判断是否过期，而这三件事都在读到 payload 之前就要做。
 */
export interface Envelope {
  readonly requestId: RequestId
  readonly event: EventName
  /** 接收方。单播是设备标识，广播用一个保留值。 */
  readonly target: DeviceId
  /** 发送方。接收方校验它与链路对端一致，防止转发伪造来源。 */
  readonly from: DeviceId
  /** 应答投递到的请求标识，请求-应答模式用来配对。 */
  readonly replyTo?: RequestId
  readonly traceId: TraceId
  readonly payload?: unknown
  readonly sentAtMs: number
  /** 存活时间。缺省表示不过期。 */
  readonly ttlMs?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// 会话与配对（§8）
// ─────────────────────────────────────────────────────────────────────────────

/** 宿主形态。 */
export type PlatformKind = 'desktop' | 'mobile' | 'server'

/**
 * 操作系统平台。
 *
 * ★ 这是一个**本地**类型，不是线类型：内核在线上传的是 `PlatformKind`（宿主形态），而具体的操作
 * 系统只在客户端视图里出现。放在这里是因为两个包都要用它，而定义一处比两处好。
 */
export type Platform = 'windows' | 'macos' | 'linux' | 'android' | 'ios'

/**
 * 配对被拒的原因。
 *
 * `busy` 而不是排队：一个弹窗是用户正在做的决定，把第二个排在它后面意味着第二个会在几分钟后
 * 被默认回答。
 */
export type PairRefusal = 'busy' | 'expired' | 'blocked'


/** 意图的展示信息，供接收方做确认弹窗。 */
export interface IntentDisplay {
  readonly title: string
  readonly body?: string
  readonly icon?: string
}

/**
 * 一个跨设备动作的调用。
 *
 * `args` 在 TS 侧是 `unknown`：内核按插件声明的 schema 校验它，而插件作者用泛型在自己的调用点
 * 收窄。给它一个索引签名会让"参数写错了"在编译期消失。
 */
export interface IntentInvocation {
  readonly intentId: IntentId
  readonly pluginId: PluginId
  readonly action: string
  readonly args: unknown
  readonly display?: IntentDisplay
}

/** 调用的结果。成功与失败共用一个形状，因为发送方两种都要处理。 */
export interface IntentOutcome {
  readonly intentId: IntentId
  readonly ok: boolean
  readonly result?: unknown
  readonly error?: SynraError
  readonly elapsedMs: number
}

// ─────────────────────────────────────────────────────────────────────────────
// 传输（§8.4）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 传输的种类。
 *
 * 两种而不是"文件/图片/剪贴板"那样分：内核只关心**该怎么处理**，而插件产物与用户文件走两条不同的
 * 落地路径（前者进插件目录并被校验签名，后者进用户可见的目录）。
 *
 * `kebab-case`。
 */
export type TransferKind = 'plugin-bundle' | 'attachment'

/**
 * 摘要算法。
 *
 * `lowercase`，所以是 `sha256` 而不是 `sha-256`。
 */
export type DigestAlgorithm = 'sha256'

/**
 * 一次传输的进度。
 *
 * ★ 这里**没有** `state` 字段。传输的状态在内核的会话状态机里，通过传输事件报告，而不是塞进每一个
 * 进度快照 —— 一个每 100 毫秒发一次的结构里放一个几乎不变的字段，是每帧都在重复同一件事。
 */
export interface TransferProgress {
  readonly transferId: TransferId
  readonly receivedBytes: number
  readonly totalBytes: number
  readonly receivedBlocks: number
  readonly totalBlocks: number
}

/** 传输被中止的原因。 */
export type TransferAbortReason =
  | 'cancelled'
  | 'rejected'
  | 'timeout'
  | 'integrity'
  | 'diskFull'
  | 'peerGone'
  | 'tooLarge'

// ─────────────────────────────────────────────────────────────────────────────
// 发现（§9）
// ─────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────
// 限制（§7.1）
// ─────────────────────────────────────────────────────────────────────────────

/** 设备间主连接的默认端口。 */
export const DEFAULT_TCP_PORT = 32100

/** UDP 发现端口。 */
export const DISCOVERY_PORT = 32101

/** mDNS 服务类型。 */
export const MDNS_SERVICE = '_synra._tcp.local'

/** 协议版本。只有 v1，且没有兼容层。 */
export const PROTOCOL_VERSION = 1
