/**
 * `@synra/protocol` —— 线协议类型。
 *
 * 这个包里的东西都是**形状**：帧、信封、事件、会话与传输的数据结构。它们由 Rust 内核的
 * `synra-protocol` crate 导出，`generated/wire.ts` 是那份导出的镜像。
 *
 * # 它不做什么
 *
 * 没有编解码、没有运行时校验、没有默认值构造。内核是唯一对字节负责的地方，这里只是让 TS 侧
 * 能**命名**那些字节的形状。加一个 `encode()` 会让这个包变成第二份实现，而两份实现迟早不一致。
 *
 * # 与 `@synra/client` 的分工
 *
 * 这个包描述**线上传输的东西**。`@synra/client` 描述**插件调用的东西** —— 注入的 `synra`
 * 对象。名字偶尔相同而含义不同的地方要留意：线上的 `DeviceSnapshot` 是内核给的事件数据，而
 * `synra.device.list()` 返回的是 `DeviceTarget`，后者是给作者的友好视图。
 */

export type {
  EventVerdict,
  KernelEvent,
  KernelEventEnvelope,
  SequencedKernelEvent,
  SequenceReport,
} from './generated/events'

// 宿主界面的形状与内核推给它的增量事件。与 `wire` 分开：那里是设备之间的协议，这里是内核与自己的
// 界面之间。
export type {
  DeviceCard,
  DevicesSnapshot,
  IdentitySnapshot,
  IntentCandidate,
  IntentPrompt,
  IntentSnapshot,
  // ★ The answer to `plugins_install`. Listed here for the same reason `ScanOptions` is: the shell's interface *reads*
  // it back, and a shape only the Rust side knows is one the page has to copy by hand — a copy that does not fail to
  // compile when the kernel adds a field.
  InstallReport,
  PairingPrompt,
  PluginHealthDto,
  PluginSnapshot,
  // ★ 这个 DTO 是界面**发出去**的，而这一块原本只列界面**读回来**的形状，所以它一直没在这里 ——
  //   宿主界面要传 `devices_scan_start` 的 `opts`，却只能在自己那边手抄一份 interface，
  //   而手抄的那份不会在 Rust 改字段时编译失败，正是"没被使用的半个契约会漂移"的另一面。
  ScanOptions,
  ScanState,
  TransferSnapshot,
  TransferSummary,
  UpdateInfo,
} from './generated/ui'

export type {
  // 身份
  DeviceId,
  DigestAlgorithm,
  // 信封
  Envelope,
  // 错误
  ErrorCode,
  EventName,
  // 发现
  FrameKind,
  IntentDisplay,
  IntentId,
  IntentInvocation,
  IntentOutcome,
  NetworkErrorCode,
  PairRefusal,
  Platform,
  // 会话
  PlatformKind,
  PluginId,
  RequestId,
  SuggestedAction,
  SynraError,
  TraceId,
  TransferAbortReason,
  TransferId,
  // 传输
  TransferKind,
  TransferProgress,
} from './generated/wire'

// ★ 这里原本导出的是**值**：`isDelta`、`MAX_COUNTED_GAP`、`SequenceTracker`、
//   `FrameKind`、`FRAME_HEADER_LEN`、`MAX_FRAME_LEN`、`MAX_CHUNK_LEN`、`MAX_PAYLOAD_LEN`、
//   `FRAME_LENGTH_OVERHEAD`、`DEFAULT_TCP_PORT`、`DISCOVERY_PORT`、`MDNS_SERVICE`、`PROTOCOL_VERSION`。
//
//   那与本包自己的说明（“这个包里的东西都是**形状**”）和设计文档（25 §2.1：
//   `@synra/protocol` 一栏是 ❌ 有运行时）都矛盾。而矛盾不只是文档问题：
//   `package.json` 的 `exports` 只给 `types`、构建也不产出 `.js`，
//   所以作者写 `import { SequenceTracker } from '@synra/protocol'`
//   **类型检查通过、运行时解析不到** —— 拿到 `undefined` 或一个打包错误，而没有任何地方提前提醒。
//
//   `packages/protocol/test/events.test.ts` 的注释其实早就写明了这件事：
//   “`@synra/protocol` 是一个**纯类型**包，所以它按设计没有运行时入口，
//   按名字 import 会解析失败”。也就是说：**测试知道这些名字拿不到，入口却照样把它们许诺出去。**
//
//   这些实现留在 `generated/events.ts` 与 `generated/wire.ts` 里（那两个文件的测试直接测源码，
//   那份测试是对的），只是不再从包的公开面出口。常量与序号逻辑的唯一真相源是 Rust 侧的
//   `synra-protocol` / `synra-ipc`；TS 这一侧只需要能**命名**那些字节的形状。
//   `FrameKind` 是个类型，所以它移到了上面的 `export type` 列表里 ——
//   `export { FrameKind }` 在 `verbatimModuleSyntax` 下同时导出值与类型，删掉它必须补上类型那一半。
