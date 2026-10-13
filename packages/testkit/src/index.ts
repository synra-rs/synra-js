/**
 * `@synra/testkit` —— 插件作者的本地假宿主。
 *
 * # 为什么它存在
 *
 * 插件作者要能"没有宿主也跑起来"：跑单测、在浏览器里预览、在 CI 里断言调用。没有它，作者只能
 * 对着真机开发，而真机上的失败很难复现。
 *
 * # 它与真宿主是**同一个类型**
 *
 * `MockSynraClient implements SynraClient`，类型来自 `@synra/client`。所以作者写测试时不会
 * "测过了但真机不对" —— 如果 mock 缺了一个方法，`tsc` 会报错，而不是等到真机上
 * `TypeError: not a function`。
 *
 * # 它是"零运行时"原则的例外，但不冲突
 *
 * `@synra/client` 零运行时，因为它只声明**注入对象**的形状。这个包是那个对象的**替身**，不是一个
 * 第二份实现 —— 两者不冲突。它也是 `devDependency`，永远不会进插件产物。
 *
 * # 它模拟的是**策略**，不是内核
 *
 * mock 会按插件声明的能力拒绝调用（`capability_denied`）、会按宿主能力拒绝平台调用
 * （`unsupported`）、会返回声明过的设备。它**不**模拟配额、不模拟传输的字节、不模拟加密。
 * 那些需要内核，而把它们做进 mock 会产生一个"通过了 mock 却在真机上因为配额被拒"的落差。
 */

import type {
  ActionDescriptor,
  ClientFeature,
  DeviceTarget,
  LogNamespace,
  PlatformCapability,
  SynraClient,
  SynraError,
  SynraFetchInit,
  SynraResponse,
  TransferProgress,
  TransferStatus,
  Unsubscribe,
} from '@synra/client'
import type { DeviceId, ErrorCode, PluginId, TransferId } from '@synra/protocol'

/** 一次被记录的调用。 */
export interface RecordedCall {
  readonly ns: string
  readonly method: string
  readonly args: readonly unknown[]
  /** 这次调用是否被拒绝，以及拒绝的原因。 */
  readonly refused?: SynraError
}

/** mock 的配置。 */
export interface MockOptions {
  /**
   * 插件被授予的能力。
   *
   * 传给 `env.can()`，也决定哪些调用会被拒。给空数组就是"什么都没授权"，那是最该先测的场景。
   */
  readonly capabilities?: readonly string[]
  /** `device.list()` 返回什么。 */
  readonly devices?: readonly DeviceTarget[]
  /** 宿主平台支持哪些能力。用来模拟 iOS 这类没有 `simulate_keys` 的平台。 */
  readonly platformCapabilities?: readonly PlatformCapability[]
  /**
   * 宿主实现了哪些方法。
   *
   * 用来模拟"宿主版本较旧、没实现 `device.pick`"。`supported` 里没有的项，调用时必须拿到
   * `unsupported` 而不是崩溃 —— mock 会照做，于是作者能测到那条降级路径。
   */
  readonly hostFeatures?: readonly ClientFeature[]
  /** `env` 的返回值。 */
  readonly env?: {
    readonly hostKind?: 'desktop' | 'mobile'
    readonly platform?: 'windows' | 'macos' | 'linux' | 'android' | 'ios'
    readonly locale?: string
    readonly darkMode?: boolean
    readonly appVersion?: string
    readonly sdkVersion?: string
  }
  /** 插件自己的 name，用于 `self.invoke` 的默认行为。 */
  readonly pluginId?: PluginId
}

/**
 * 一次调用的结果。
 *
 * `null` 表示成功，一个 `SynraError` 表示被拒。
 */
type Outcome = SynraError | null

/** 构造一个 `SynraError`。 */
export function synraError(
  code: ErrorCode,
  message: string,
  extra?: { readonly retryable?: boolean; readonly traceId?: string; readonly actions?: readonly import('@synra/protocol').SuggestedAction[] },
): SynraError {
  return {
    code,
    message,
    retryable: extra?.retryable ?? false,
    ...(extra?.actions === undefined ? {} : { actions: extra.actions }),
    ...(extra?.traceId === undefined ? {} : { traceId: extra.traceId }),
  }
}

/** 一个能力被拒的错误。 */
function denied(capability: string): SynraError {
  return synraError('capability_denied', `the plugin has not been granted ${capability}`, {
    actions: [{ kind: 'requestCapability', capability }],
  })
}

/** 宿主未实现某个方法的错误。 */
function unsupported(feature: ClientFeature): SynraError {
  return synraError('unsupported', `this host does not implement ${feature}`)
}

/**
 * 一个假的 `synra`。
 *
 * 每个方法都返回真实签名里的类型，所以作者的 UI 代码与测试代码共享同一套类型收窄。
 */
export class MockSynraClient implements SynraClient {
  /** 按顺序记录的每一次调用，供断言。 */
  readonly calls: RecordedCall[] = []

  /** 被 stub 掉的方法，键是 `ns.method`。 */
  private readonly stubs = new Map<string, unknown>()

  private readonly capabilities: ReadonlySet<string>
  private readonly devices: DeviceTarget[]
  private readonly platformCapabilities: ReadonlySet<PlatformCapability>
  private readonly features: ReadonlySet<ClientFeature>
  private readonly options: MockOptions

  /** 存储的底层表。与公开的 `storage` namespace 分开命名，否则同名字段会撞在一起。 */
  private readonly store = new Map<string, unknown>()
  private readonly subscribers = new Map<string, Set<(payload: unknown) => void>>()
  private readonly deviceWatchers = new Set<(devices: DeviceTarget[]) => void>()
  private readonly progressWatchers = new Map<TransferId, Set<(progress: TransferProgress) => void>>()
  private nextId = 0

  constructor(options: MockOptions = {}) {
    this.options = options
    this.capabilities = new Set(options.capabilities ?? [])
    this.devices = [...(options.devices ?? [])]
    this.platformCapabilities = new Set(options.platformCapabilities ?? [])
    // 默认实现四个最容易用到的，其余要显式声明 —— 于是"没声明就用"会在测试里得到 `unsupported`，
    // 而那正是真机上会发生的事。
    this.features = new Set(
      options.hostFeatures ?? ['event.subscribe', 'transfer.onProgress', 'clipboard.read'],
    )
  }

  // ── 调用记录 ────────────────────────────────────────────────────────────────

  /** 记录一次调用，返回一个是否被拒的判定。 */
  private record(ns: string, method: string, args: readonly unknown[], outcome: Outcome): Outcome {
    this.calls.push(
      outcome === null ? { ns, method, args } : { ns, method, args, refused: outcome },
    )
    return outcome
  }

  /** 某次调用是否发生过。 */
  called(ns: string, method: string): boolean {
    return this.calls.some((call) => call.ns === ns && call.method === method)
  }

  /** 某个方法被调用了几次。 */
  callCount(ns: string, method: string): number {
    return this.calls.filter((call) => call.ns === ns && call.method === method).length
  }

  /** 最后一次调用某个方法的参数。 */
  lastArgs(ns: string, method: string): readonly unknown[] | undefined {
    for (let index = this.calls.length - 1; index >= 0; index -= 1) {
      const call = this.calls[index]
      if (call && call.ns === ns && call.method === method) return call.args
    }
    return undefined
  }

  /** 清空记录，保留订阅与存储。 */
  clearCalls(): void {
    this.calls.length = 0
  }

  // ── Stub ────────────────────────────────────────────────────────────────────

  /**
   * 让某个方法返回固定结果，或抛出固定错误。
   *
   * `ns` 与 `method` 分开而不是一个点分路径：点分路径要解析，而解析在测试代码里是没必要的失败点。
   */
  stub(ns: string, method: string, value: unknown): void {
    this.stubs.set(`${ns}.${method}`, value)
    void this.record(ns, method, ['<stubbed>'], null)
  }

  /** 取一个 stub 的值。 */
  private stubbed<T>(ns: string, method: string): { hit: true; value: T } | { hit: false } {
    const key = `${ns}.${method}`
    if (!this.stubs.has(key)) return { hit: false }
    return { hit: true, value: this.stubs.get(key) as T }
  }

  /** 模拟一次事件投递，触发匹配的订阅者。 */
  deliver(pattern: string, payload: unknown): number {
    let delivered = 0
    for (const [subscribed, handlers] of this.subscribers) {
      if (matches(subscribed, pattern)) {
        for (const handler of handlers) handler(payload)
        delivered += handlers.size
      }
    }
    return delivered
  }

  /** 模拟设备集合变化。 */
  setDevices(devices: readonly DeviceTarget[]): void {
    this.devices.length = 0
    this.devices.push(...devices)
    for (const watcher of this.deviceWatchers) watcher([...this.devices])
  }

  /** 模拟传输进度。 */
  reportProgress(progress: TransferProgress): void {
    for (const watcher of this.progressWatchers.get(progress.transferId) ?? []) watcher(progress)
  }

  /** 一个可读的调用清单，用于断言失败时的输出。 */
  describeCalls(): string {
    return this.calls
      .map((call) => {
        const suffix = call.refused ? ` -> ${call.refused.code}` : ''
        return `${call.ns}.${call.method}(${String(call.args.length)} args)${suffix}`
      })
      .join('\n')
  }

  // ── env ─────────────────────────────────────────────────────────────────────

  readonly env = {
    hostKind: (): 'desktop' | 'mobile' => this.options.env?.hostKind ?? 'desktop',
    platform: (): 'windows' | 'macos' | 'linux' | 'android' | 'ios' =>
      this.options.env?.platform ?? 'linux',
    locale: (): string => this.options.env?.locale ?? 'en',
    darkMode: (): boolean => this.options.env?.darkMode ?? false,
    appVersion: (): string => this.options.env?.appVersion ?? '0.0.0-mock',
    sdkVersion: (): string => this.options.env?.sdkVersion ?? '0.1.0',
    platformSupports: (capability: PlatformCapability): boolean => {
      this.record('env', 'platformSupports', [capability], null)
      return this.platformCapabilities.has(capability)
    },
    hostSupports: (feature: ClientFeature): boolean => {
      this.record('env', 'hostSupports', [feature], null)
      return this.features.has(feature)
    },
    can: (capability: string): boolean => {
      this.record('env', 'can', [capability], null)
      return this.capabilities.has(capability) || this.capabilities.has('*')
    },
  }

  // ── log ─────────────────────────────────────────────────────────────────────

  readonly log: LogNamespace = this.buildLog('')

  private buildLog(prefix: string): LogNamespace {
    const emit = (level: string) => (msg: string, ctx?: Record<string, unknown>) => {
      this.record('log', level, prefix ? [`${prefix} ${msg}`, ctx] : [msg, ctx], null)
    }
    return {
      trace: emit('trace'),
      debug: emit('debug'),
      info: emit('info'),
      warn: emit('warn'),
      error: emit('error'),
      child: (inner: string): LogNamespace =>
        this.buildLog(prefix ? `${prefix} ${inner}` : inner),
    }
  }

  // ── event ───────────────────────────────────────────────────────────────────

  readonly event = {
    emit: async (event: string, payload?: unknown): Promise<void> => {
      const stub = this.stubbed<void>('event', 'emit')
      if (stub.hit) return stub.value
      const outcome = this.record('event', 'emit', [event, payload], null)
      void outcome
    },
    subscribe: <T = unknown>(pattern: string, handler: (payload: T) => void): Unsubscribe => {
      this.record('event', 'subscribe', [pattern], null)
      const handlers = this.subscribers.get(pattern) ?? new Set()
      const wrapped = handler as (payload: unknown) => void
      handlers.add(wrapped)
      this.subscribers.set(pattern, handlers)
      // 真实的订阅一定会返回退订函数，mock 也必须 —— 否则作者的清理代码在测试里跑不到。
      return () => {
        handlers.delete(wrapped)
      }
    },
  }

  // ── device ──────────────────────────────────────────────────────────────────

  readonly device = {
    list: async (): Promise<DeviceTarget[]> => {
      const stub = this.stubbed<DeviceTarget[]>('device', 'list')
      if (stub.hit) return stub.value
      const outcome = this.gate('device:list')
      this.record('device', 'list', [], outcome)
      if (outcome) throw outcome
      return this.devices.filter((device) => device.online)
    },

    send: async (req: {
      to: DeviceId
      event: string
      payload?: unknown
    }): Promise<void> => {
      const stub = this.stubbed<void>('device', 'send')
      if (stub.hit) return stub.value
      const outcome = this.gate(`device:send:${req.to}`)
      this.record('device', 'send', [req], outcome)
      if (outcome) throw outcome
    },

    broadcast: async (req: { event: string; payload?: unknown }): Promise<void> => {
      const stub = this.stubbed<void>('device', 'broadcast')
      if (stub.hit) return stub.value
      const outcome = this.gate('device:broadcast')
      this.record('device', 'broadcast', [req], outcome)
      if (outcome) throw outcome
    },

    onChange: (handler: (devices: DeviceTarget[]) => void): Unsubscribe => {
      if (!this.features.has('device.onChange')) {
        const error = unsupported('device.onChange')
        this.record('device', 'onChange', [], error)
        throw error
      }
      this.record('device', 'onChange', [], null)
      this.deviceWatchers.add(handler)
      return () => {
        this.deviceWatchers.delete(handler)
      }
    },

    pick: async (options?: unknown): Promise<DeviceId | null> => {
      if (!this.features.has('device.pick')) {
        // ★ 未实现时必须**明确拒绝**，不是返回 `undefined`。作者先 `hostSupports('device.pick')`
        //   再决定要不要用，这条路径是他们要测的。
        const error = unsupported('device.pick')
        this.record('device', 'pick', [options], error)
        throw error
      }
      const stub = this.stubbed<DeviceId | null>('device', 'pick')
      if (stub.hit) return stub.value
      this.record('device', 'pick', [options], null)
      const first = this.devices.find((device) => device.online)
      return first ? first.deviceId : null
    },

    supported: [] as readonly ClientFeature[],
  }

  // ── storage ─────────────────────────────────────────────────────────────────

  readonly storage = {
    get: async <T = unknown>(key: string, defaults?: { fallback: T }): Promise<T | undefined> => {
      const stub = this.stubbed<T | undefined>('storage', 'get')
      if (stub.hit) return stub.value
      const outcome = this.gate('storage:local:read')
      this.record('storage', 'get', [key], outcome)
      if (outcome) throw outcome
      if (this.store.has(key)) return this.store.get(key) as T
      return defaults ? defaults.fallback : undefined
    },

    set: async <T = unknown>(key: string, value: T): Promise<void> => {
      const stub = this.stubbed<void>('storage', 'set')
      if (stub.hit) return stub.value
      const outcome = this.gate('storage:local:write')
      this.record('storage', 'set', [key, value], outcome)
      if (outcome) throw outcome
      this.store.set(key, value)
    },

    delete: async (key: string): Promise<void> => {
      const stub = this.stubbed<void>('storage', 'delete')
      if (stub.hit) return stub.value
      const outcome = this.gate('storage:local:write')
      this.record('storage', 'delete', [key], outcome)
      if (outcome) throw outcome
      this.store.delete(key)
    },

    keys: async (prefix?: string): Promise<string[]> => {
      const stub = this.stubbed<string[]>('storage', 'keys')
      if (stub.hit) return stub.value
      const outcome = this.gate('storage:local:read')
      this.record('storage', 'keys', [prefix], outcome)
      if (outcome) throw outcome
      const all = [...this.store.keys()]
      return prefix === undefined ? all : all.filter((key) => key.startsWith(prefix))
    },

    quota: async (): Promise<{ usedBytes: number; maxBytes: number }> => {
      this.record('storage', 'quota', [], null)
      // 用 JSON 的长度估一下，够断言用。真配额由内核算，mock 不该假装能算准。
      const used = JSON.stringify([...this.store]).length
      return { usedBytes: used, maxBytes: 8 * 1024 * 1024 }
    },
  }

  // ── network ─────────────────────────────────────────────────────────────────

  readonly network = {
    fetch: async (input: string, init?: SynraFetchInit): Promise<SynraResponse> => {
      if (!this.features.has('network.fetch')) {
        const error = unsupported('network.fetch')
        this.record('network', 'fetch', [input, init], error)
        throw error
      }
      const stub = this.stubbed<SynraResponse>('network', 'fetch')
      if (stub.hit) return stub.value

      const outcome = this.gate(`network:fetch:${hostOf(input)}`)
      this.record('network', 'fetch', [input, init], outcome)
      if (outcome) throw outcome

      // 一个空的响应，而不是一个假造的成功 —— mock 不该假装知道远端返回了什么。要断言内容时用
      // `stub('network', 'fetch', response)`。
      let consumed = false
      const once = <T>(value: T) => (): Promise<T> => {
        if (consumed) {
          // The rejection reason is a structured `SynraError`, not an `Error`: the client's contract is
          // that failures carry a `code` a caller branches on, and wrapping it in an `Error` would put
          // the code somewhere the author has to dig for.
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          return Promise.reject(synraError('internal', 'the body has already been read'))
        }
        consumed = true
        return Promise.resolve(value)
      }
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        url: input,
        ok: true,
        redirected: false,
        text: once(''),
        json: once({}),
        bytes: once(new Uint8Array()),
      }
    },
  }

  // ── transfer ────────────────────────────────────────────────────────────────

  readonly transfer = {
    send: async (req: {
      to: DeviceId
      file: Blob
      fileName: string
      contextId?: string
    }): Promise<TransferId> => {
      const stub = this.stubbed<TransferId>('transfer', 'send')
      if (stub.hit) return stub.value
      const outcome = this.gate(`file:transfer:send`)
      this.record('transfer', 'send', [req], outcome)
      if (outcome) throw outcome
      return `mock-transfer-${String((this.nextId += 1))}`
    },

    status: async (id: TransferId): Promise<TransferStatus> => {
      const stub = this.stubbed<TransferStatus>('transfer', 'status')
      if (stub.hit) return stub.value
      this.record('transfer', 'status', [id], null)
      return { transferId: id, state: 'completed', receivedBytes: 0, totalBytes: 0 }
    },

    onProgress: (id: TransferId, handler: (progress: TransferProgress) => void): Unsubscribe => {
      if (!this.features.has('transfer.onProgress')) {
        const error = unsupported('transfer.onProgress')
        this.record('transfer', 'onProgress', [id], error)
        throw error
      }
      this.record('transfer', 'onProgress', [id], null)
      const handlers = this.progressWatchers.get(id) ?? new Set()
      handlers.add(handler)
      this.progressWatchers.set(id, handlers)
      return () => {
        handlers.delete(handler)
      }
    },
  }

  // ── platform ────────────────────────────────────────────────────────────────

  readonly platform = {
    openUrl: async (url: string): Promise<void> => {
      const stub = this.stubbed<void>('platform', 'openUrl')
      if (stub.hit) return stub.value
      const outcome = this.platformGate('platform:open-url', 'open_url')
      this.record('platform', 'openUrl', [url], outcome)
      if (outcome) throw outcome
    },

    notify: async (req: { title: string; body: string }): Promise<void> => {
      const stub = this.stubbed<void>('platform', 'notify')
      if (stub.hit) return stub.value
      const outcome = this.platformGate('platform:notify', 'notify')
      this.record('platform', 'notify', [req], outcome)
      if (outcome) throw outcome
    },
  }

  // ── clipboard ───────────────────────────────────────────────────────────────

  readonly clipboard = {
    read: async (): Promise<string> => {
      if (!this.features.has('clipboard.read')) {
        const error = unsupported('clipboard.read')
        this.record('clipboard', 'read', [], error)
        throw error
      }
      const stub = this.stubbed<string>('clipboard', 'read')
      if (stub.hit) return stub.value
      const outcome = this.platformGate('platform:clipboard:read', 'clipboard_read')
      this.record('clipboard', 'read', [], outcome)
      if (outcome) throw outcome
      return ''
    },

    write: async (text: string): Promise<void> => {
      const stub = this.stubbed<void>('clipboard', 'write')
      if (stub.hit) return stub.value
      const outcome = this.platformGate('platform:clipboard:write', 'clipboard_write')
      this.record('clipboard', 'write', [text], outcome)
      if (outcome) throw outcome
    },
  }

  // ── self ────────────────────────────────────────────────────────────────────

  private readonly declaredActions: ActionDescriptor[] = []

  readonly self = {
    invoke: async <Args = unknown, Result = unknown>(
      action: string,
      args?: Args,
    ): Promise<Result> => {
      const stub = this.stubbed<Result>('self', 'invoke')
      if (stub.hit) return stub.value
      this.record('self', 'invoke', [action, args], null)
      // 没有 stub 就丢一个错误，而不是返回 `undefined`：headless 部分在单测里不存在，返回
      // `undefined` 会让作者的代码把 `undefined` 当成一个结果继续跑。
      throw synraError(
        'internal',
        `self.invoke(${action}) has no stub; call client.stub("self", "invoke", result)`,
      )
    },

    actions: async (): Promise<ActionDescriptor[]> => {
      const stub = this.stubbed<ActionDescriptor[]>('self', 'actions')
      if (stub.hit) return stub.value
      this.record('self', 'actions', [], null)
      return [...this.declaredActions]
    },
  }

  /** 声明一个 headless action，供 `self.actions()` 返回。 */
  declareAction(descriptor: ActionDescriptor): void {
    this.declaredActions.push(descriptor)
  }

  // ── 判定函数 ────────────────────────────────────────────────────────────────

  isSynraError(value: unknown): value is SynraError {
    return (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as { code?: unknown }).code === 'string' &&
      typeof (value as { message?: unknown }).message === 'string' &&
      typeof (value as { retryable?: unknown }).retryable === 'boolean'
    )
  }

  isCode(value: unknown, code: ErrorCode): boolean {
    return this.isSynraError(value) && value.code === code
  }

  requestId(): string {
    return `mock-request-${String((this.nextId += 1))}`
  }

  // ── 内部 ────────────────────────────────────────────────────────────────────

  /** 能力闸门。返回 `null` 表示通过。 */
  private gate(capability: string): Outcome {
    if (this.capabilities.has('*')) return null
    if (this.capabilities.has(capability)) return null
    // 通配授权：`device:send:*` 覆盖 `device:send:peer-a`。
    const parts = capability.split(':')
    for (let take = parts.length - 1; take > 0; take -= 1) {
      const candidate = [...parts.slice(0, take), '*'].join(':')
      if (this.capabilities.has(candidate)) return null
    }
    return denied(capability)
  }

  /**
   * 平台闸门，检查两个条件。
   *
   * `env.platformSupports` 与 `env.can` 是**不同的问题**，所以分开拒绝并给出不同的错误码：
   * 一个能力可能被授予而平台不支持（用户在 iOS 上批准了按键模拟），也可能平台支持而没被授予。
   * 两种情况界面上要说不同的话。
   */
  private platformGate(capability: string, platform: PlatformCapability): Outcome {
    if (!this.platformCapabilities.has(platform)) {
      return synraError('unsupported', `this platform does not support ${platform}`)
    }
    return this.gate(capability)
  }
}

/**
 * 建一个假的 `synra`。
 *
 * 返回的实例同时是 `SynraClient` 与 `MockSynraClient`，所以既能当注入对象用，也能断言调用。
 */
export function createMockClient(options: MockOptions = {}): MockSynraClient {
  const client = new MockSynraClient(options)
  // `supported` 是只读快照，在构造之后填 —— 它依赖构造参数，而字段初始化器拿不到。
  Object.defineProperty(client.device, 'supported', {
    value: [...(options.hostFeatures ?? ['event.subscribe', 'transfer.onProgress', 'clipboard.read'])],
    enumerable: true,
  })
  return client
}

/** 从一个 URL 里取出主机名，用于能力字符串。取不出来时返回一个不会是合法主机的值。 */
function hostOf(url: string): string {
  const match = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/([^/?#]+)/.exec(url)
  return match?.[1] ?? '<unknown>'
}

/**
 * 一个事件模式是否匹配一个具体的事件名。
 *
 * 与内核的 handle 模式语义一致：`*` 匹配**恰好一段**，段数必须相等。`_synra.*` 不匹配
 * `_synra.device.changed` —— 这正是"某个宿主没有实现"这类落差最容易出现的地方，所以 mock 与内核
 * 用同一套语义。
 */
export function matches(pattern: string, name: string): boolean {
  const patternParts = pattern.split('.')
  const nameParts = name.split('.')
  if (patternParts.length !== nameParts.length) return false
  return patternParts.every((part, index) => part === '*' || part === nameParts[index])
}
