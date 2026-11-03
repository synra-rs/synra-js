/** Diagnostics and metrics mirrors from synra-ipc and synra-observe. */
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
