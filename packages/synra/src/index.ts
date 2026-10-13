/**
 * `synra` —— 汇总对外类型面。
 *
 * # 为什么"一般不用安装"
 *
 * 这个包的存在只是为了让作者能写不带 scope 的短路径：
 *
 * ```ts
 * import type { SynraError } from 'synra'
 * ```
 *
 * 而不用在 `package.json` 里多装一个包。机制是**传递依赖**：`@synra/client` 依赖本包，所以
 * 作者装了 `@synra/client` 之后，`node_modules/synra` 也在那里，`'synra'` 就能解析。
 *
 * 代价是"依赖关系不那么显式"。收益是作者少一个包、少一个要对齐的版本。为了让行为可预测，
 * 三个包（`synra`、`@synra/client`、`@synra/protocol`）**同步发布同一个版本号** —— 它们互相
 * re-export，版本错位会产生"类型来自不同代次"的诡异错误，而那种错误极难诊断。
 *
 * # 禁止的事
 *
 * - ❌ 放**运行时实现**：会破坏"零运行时"，并与注入对象形成两份实现。
 * - ❌ 定义**新类型**：会造成同一类型两处定义，而两处会漂移。
 * - ❌ 让它成为**唯一**入口：`testkit` 依赖 `@synra/client`，且 `types` 需要包名稳定。
 * - ❌ 让插件把它写进 **`dependencies`**：它零运行时，进运行时依赖只会让人以为它有用。
 */

// ★ `export type *` 而不是 `export *`：本包只有类型，用 `export *` 会让编译产物里有一个
//   运行时的 re-export 语句，而它 re-export 的东西不存在。
export type * from '@synra/client'
export type * from '@synra/protocol'

// 关键几个显式再导出一次，给 IDE 更好的跳转与补全：`export type *` 让符号可见，但显式列出会在
// 悬停时直接给出定义处，而不是绕经两次 re-export。
export type { SynraClient, SynraError, SynraErrorCode, SynraResponse, Unsubscribe } from '@synra/client'

export type {
  DeviceId,
  DigestAlgorithm,
  Envelope,
  ErrorCode,
  IntentId,
  IntentInvocation,
  IntentOutcome,
  PairRefusal,
  Platform,
  PlatformKind,
  PluginId,
  RequestId,
  SuggestedAction,
  TraceId,
  TransferAbortReason,
  TransferId,
  TransferKind,
  TransferProgress,
} from '@synra/protocol'