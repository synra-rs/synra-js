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
  ConfigSnapshot,
  DeviceCard,
  IntentSnapshot,
  PairingSnapshot,
  PluginSnapshot,
  ScanState,
  TransferSnapshot,
  UpdateInfo,
} from './ui'

/** 一台设备的标识。 */
type DeviceId = string
/** 一个插件的标识。 */
type PluginId = string
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
  | { readonly type: 'pairingUpdated'; readonly payload: PairingSnapshot }
  | { readonly type: 'intentUpdated'; readonly payload: IntentSnapshot }
  | { readonly type: 'intentFinished'; readonly payload: { readonly intentId: IntentId } }
  // ★ 整份快照，不是补丁：补丁是**写入方**的输入，不是结果的描述，读者若自己重放一遍就是在重算内核已知的东西。
  | { readonly type: 'configUpdated'; readonly payload: ConfigSnapshot }
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

// ★ 这里原本还有 `MAX_COUNTED_GAP`、`SequenceTracker`、`isDelta`
//   和它们的测试，现在移到了它们唯一的消费方：
//   `synra-rust-app/src/ipc/sequence.ts`。
//
//   理由是这个包的契约：`@synra/protocol` 是**纯类型**包
//   （设计文档 25 §2.1 的“有运行时？”一栏是 ❌），
//   `package.json` 只给 `types`、构建也不产出 `.js`。
//   一个带实现的类放在这里，对消费者来说就是一个只能编译、不能运行的承诺。
//   它们之前确实从这个包的入口导出过，而第一个真正导入它们的消费者
//   （应用的 `src/ipc/dispatcher.ts`）就是被类型检查抳住的。
//
//   这里保留的是**形状**：`EventVerdict` / `KernelEvent` / `SequenceReport` 等类型。
//   TS 这一侧只需要能命名那些字节；序号的算术则由真正需要它的那一侧拥有。

/**
 * 序号跟踪器的快照，用于诊断包。
 *
 * ★ 这是一个**类型**，所以它留在这里 —— 而它的实现者（`SequenceTracker`）
 * 在真正需要它的那一侧：`synra-rust-app/src/ipc/sequence.ts`。
 * 原本它与那个类写在同一段里，而删掉那段时差点把它一起删掉：
 * 它定义在常量**之后**，而那正好是切割点。
 */
export interface SequenceReport {
  readonly last?: number
  readonly gaps: number
}
