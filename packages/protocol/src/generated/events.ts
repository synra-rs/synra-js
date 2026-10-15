/* eslint-disable */
/**
 * ⚠️ **手写镜像，由脚本核对** —— 不是自动生成的。
 *
 * 来源：synra-rust-core/crates/synra-ipc/src/event.rs
 * 核对：synra-js/scripts/check-shapes.ts
 *
 * ★ 这里曾经写着"自动生成，请勿手动修改"，并给出 `cargo test -p synra-ipc --features ts-export`
 * 这条命令。**那条命令跑不起来**：synra-ipc 没有 `[features]` 段，`ts_export.rs` 只生成
 * `ErrorCode` 与 `SuggestedAction` 两个联合类型，不生成本文件。本文件是手写的。
 */

import type {
  DeviceCard,
  IntentSnapshot,
  PairingPrompt,
  PluginSnapshot,
  ScanState,
  TransferSnapshot,
  UpdateInfo,
} from './ui'

/** 一台设备的标识。 */
type DeviceId = string
/** 一个插件的标识。 */
type PluginId = string
/** 一个请求的标识。 */
type RequestId = string
/** 一个意图的标识。 */
type IntentId = string
/** 一个传输会话的标识。 */
type TransferId = string

/**
 * 内核告诉界面的一次变化。
 *
 * 内部标签是 `type`，所以界面的 `switch` 是封闭集合上的穷尽判断 —— 而跨版本偏移时，`default` 分支
 * 就是"重新取一次快照"的地方。
 */
export type KernelEvent =
  | { readonly type: 'deviceCardUpdated'; readonly payload: DeviceCard }
  | { readonly type: 'deviceRemoved'; readonly payload: { readonly deviceId: DeviceId } }
  | { readonly type: 'scanUpdated'; readonly payload: ScanState }
  | { readonly type: 'pairingRequested'; readonly payload: PairingPrompt }
  | { readonly type: 'pairingResolved'; readonly payload: { readonly requestId: RequestId } }
  | { readonly type: 'intentUpdated'; readonly payload: IntentSnapshot }
  | { readonly type: 'intentFinished'; readonly payload: { readonly intentId: IntentId } }
  | { readonly type: 'transferUpdated'; readonly payload: TransferSnapshot }
  | { readonly type: 'transferFinished'; readonly payload: { readonly transferId: TransferId } }
  | { readonly type: 'pluginUpdated'; readonly payload: PluginSnapshot }
  | {
      readonly type: 'pluginInstallProgress'
      readonly payload: {
        readonly pluginId: PluginId
        readonly progress: number
        readonly stage: string
      }
    }
  | {
      readonly type: 'pluginUpdateAvailable'
      readonly payload: { readonly pluginId: PluginId; readonly update: UpdateInfo }
    }
  | {
      readonly type: 'pluginHealthChanged'
      readonly payload: {
        readonly pluginId: PluginId
        readonly health: string
        readonly explanation: string
      }
    }
  | {
      readonly type: 'pluginConsentRequested'
      readonly payload: {
        readonly pluginId: PluginId
        readonly title: string
        readonly capabilities: readonly string[]
        readonly manifestDigest: string
      }
    }
  | {
      readonly type: 'logLine'
      readonly payload: { readonly level: string; readonly line: string }
    }
  | {
      readonly type: 'notice'
      readonly payload: { readonly message: string; readonly params: unknown }
    }

/** 带序号的事件。 */
export interface KernelEventEnvelope {
  /** 单调递增。内核每发布一次事件就加一。 */
  readonly seq: number
  /** 发布时刻，毫秒。用于显示与诊断，**不用于排序** —— 排序靠序号。 */
  readonly at: number
}

/**
 * 带序号的事件，扁平化。
 *
 * `KernelEventEnvelope` 与 `KernelEvent` 在线上是**一个**对象（Rust 侧 `#[serde(flatten)]`），
 * 所以这里的交叉类型就是那个形状。分成两个类型是为了让"事件是什么"与"它在序列的哪里"可以分别
 * 命名。
 */
export type SequencedKernelEvent = KernelEvent & KernelEventEnvelope

/** 界面该拿一个事件怎么办。 */
export type EventVerdict =
  /** 应用它。序号连续，或这是第一个事件。 */
  | { readonly kind: 'apply' }
  /**
   * 忽略它。序号不大于已见的最后一个，所以是重复投递。
   *
   * 应用它正是"列表多出一行"的成因：通道会在重载前后把同一个事件投两次。
   */
  | { readonly kind: 'ignoreRepeat' }
  /**
   * 重新取一次快照。有事件被丢了，画面已经不可信。
   *
   * 间隙无法从事件本身修复 —— 丢掉的已经没了。
   */
  | { readonly kind: 'refreshSnapshot'; readonly missed?: number }
  /** 应用它**并且**重新取快照。用于界面不认识的事件。 */
  | { readonly kind: 'applyAndRefresh' }

/** 值得计数的最大间隙。 */
export const MAX_COUNTED_GAP = 1000

/** 序号跟踪器的快照，用于诊断包。 */
export interface SequenceReport {
  readonly last?: number
  readonly gaps: number
}

/**
 * 跟踪序号，让界面能分清"间隙"与"重复"。
 *
 * 只持有最后一个序号，不含运行时：调用方喂进每一个信封，按裁决行事。这样做的原因与 Rust 侧一样 ——
 * 这段算术就是机制的全部，而它是唯一会答错的东西。
 */
export class SequenceTracker {
  private last: number | undefined
  private gapCount = 0
  private stale = false

  /** 已应用的最后一个序号。 */
  get lastSeen(): number | undefined {
    return this.last
  }

  /** 报告过多少次间隙。 */
  get gaps(): number {
    return this.gapCount
  }

  /**
   * 画面是否已知不可信。
   *
   * 从报告一次间隙起为真，直到快照回应为止。此时仍然渲染的调用方，展示的是它自己知道不对的东西。
   */
  get isStale(): boolean {
    return this.stale
  }

  /**
   * 判断一个事件并记录它。
   *
   * ★ **第一个事件不是间隙。** 什么都没见过时接受任何序号：内核的计数器从一开始，所以中途启动的界面
   * 否则会立刻报一次间隙，去重读它刚取过的快照。
   */
  observe(seq: number): EventVerdict {
    const last = this.last

    if (last === undefined) {
      this.last = seq
      return { kind: 'apply' }
    }
    if (seq <= last) {
      // 重复。**不推进序号** —— 推进会让下一个连续事件看起来像间隙。
      return { kind: 'ignoreRepeat' }
    }
    if (seq === last + 1) {
      this.last = seq
      return { kind: 'apply' }
    }

    // 间隙。记下来并标记画面不可信。
    const missed = seq - (last + 1)
    this.last = seq
    this.gapCount += 1
    this.stale = true
    // 几千的跳变给出的是没人会读的数字，而对一个来自外部的值做减法可能溢出。
    return missed <= MAX_COUNTED_GAP ? { kind: 'refreshSnapshot', missed } : { kind: 'refreshSnapshot' }
  }

  /** 记录已取过一次快照，画面重新可信。 */
  snapshotTaken(): void {
    this.stale = false
  }

  /**
   * 忘掉一切，用于界面被重载。
   *
   * 序号**不跨重载持久化**：回来的界面会取快照，而记住的序号会让重载后的第一个事件看起来像间隙。
   */
  reset(): void {
    this.last = undefined
    this.stale = false
  }

  /** 诊断用的快照。 */
  report(): SequenceReport {
    return this.last === undefined
      ? { gaps: this.gapCount }
      : { last: this.last, gaps: this.gapCount }
  }
}

/**
 * 一个事件是否携带增量。
 *
 * 今天全部为 `false`：每个事件带的是**绝对值**（进度是比例而非字节数），所以重复应用它不改变什么。
 * 这个函数存在，是为了将来某个携带增量的事件必须自己说出来，而不是被当作幂等的。
 */
export function isDelta(_event: KernelEvent): boolean {
  return false
}
