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
  // 身份
  DeviceId,
  PluginId,
  IntentId,
  TransferId,
  RequestId,
  EventName,
  TraceId,
  // 错误
  ErrorCode,
  NetworkErrorCode,
  SuggestedAction,
  SynraError,
  // 信封
  Envelope,
  // 会话
  PlatformKind,
  Platform,
  PairRefusal,
  IntentDisplay,
  IntentInvocation,
  IntentOutcome,
  // 传输
  TransferKind,
  DigestAlgorithm,
  TransferProgress,
  TransferAbortReason,
  // 发现
} from './generated/wire'

// 宿主界面的形状与内核推给它的增量事件。与 `wire` 分开：那里是设备之间的协议，这里是内核与自己的
// 界面之间。
export type {
  DeviceCard,
  IdentitySnapshot,
  IntentCandidate,
  IntentPrompt,
  IntentSnapshot,
  PairingPrompt,
  PluginHealthDto,
  PluginSnapshot,
  ScanState,
  TransferSnapshot,
  TransferSummary,
  UpdateInfo,
} from './generated/ui'

export type {
  EventVerdict,
  KernelEvent,
  KernelEventEnvelope,
  SequenceReport,
  SequencedKernelEvent,
} from './generated/events'

export { isDelta, MAX_COUNTED_GAP, SequenceTracker } from './generated/events'

export {
  FrameKind,
  FRAME_HEADER_LEN,
  FRAME_LENGTH_OVERHEAD,
  MAX_FRAME_LEN,
  MAX_CHUNK_LEN,
  MAX_PAYLOAD_LEN,
  DEFAULT_TCP_PORT,
  DISCOVERY_PORT,
  MDNS_SERVICE,
  PROTOCOL_VERSION,
} from './generated/wire'