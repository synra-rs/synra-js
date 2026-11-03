/** Intent and transfer DTOs from synra-ipc/src/dto. */
import type { ErrorCode, SuggestedAction } from './wire'

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

/** 一个 IPC 拒绝：稳定的 code、可翻译的 message key，以及可选的参数与建议动作。 */
export interface IpcError {
  readonly code: ErrorCode
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
  readonly candidates?: readonly IntentCandidate[]
  readonly prompt?: IntentPrompt
  readonly error?: IpcError
  /** 这个设备正在为“没人回答的 dispatch”重试到什么程度；第一次失败之前没有。 */
  readonly retry?: IntentRetry
  readonly startedAtMs: number
}

/**
 * 重试的进度。
 *
 * ★ `gaveUp` 为真时意图仍是 `dispatching`：放弃的是**这个进程的努力**，不是动作的结果。
 */
export interface IntentRetry {
  readonly attempts: number
  readonly maxAttempts: number
  readonly gaveUp: boolean
  /** 下一次尝试的时间（epoch 毫秒）；没有排期时缺席。 */
  readonly nextAtMs?: number
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
