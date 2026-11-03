/** Handwritten IPC mirrors; field presence follows Rust serde serialization. */
export type * from './ui-activity'
export type * from './ui-diagnostics'
export type * from './ui-plugins'

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

/**
 * Where a pairing attempt has got to.
 *
 * `waiting` means this device is waiting for the other person; `asked` means the other person is
 * waiting for this one. They are separate words because they put the code on different screens.
 */
export type PairingPhase = 'idle' | 'waiting' | 'asked' | 'done'

/** How a pairing attempt ended. */
export type PairingOutcome = 'paired' | 'refused' | 'cancelled' | 'timedOut'

/** The request this device started: the code is on this screen. */
export interface PairingOffer {
  readonly code: string
  readonly deviceId: string
  readonly displayName: string
  readonly platform: string
}

/** The request the other device started: the code is on that screen. */
export interface PairingAsk {
  readonly code: string
  readonly deviceId: string
  readonly displayName: string
  readonly platform: string
}

/** Everything the pairing panel draws, in one value. */
export interface PairingSnapshot {
  readonly phase: PairingPhase
  readonly offer?: PairingOffer
  readonly ask?: PairingAsk
  readonly outcome?: PairingOutcome
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
