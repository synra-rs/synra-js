/**
 * The consumer check.
 *
 * ★ There is **no import** in this file, and that is the whole point. If `types: ["@synra/client"]`
 * stops being enough to get the global `synra`, this file fails to compile — which is the only way to
 * catch that regression, because the package's own build would still succeed.
 *
 * It is a `.ts` file rather than a `.d.ts` because the failures being guarded against are about
 * *using* the types: a declaration file that only names them would not exercise the surface.
 */

// ── 写法一：全局 synra，不用 import、不用判空 ────────────────────────────────

export async function listDevices(): Promise<string[]> {
  const devices = await synra.device.list()
  return devices.map((device) => device.deviceId)
}

// ── 写法二：window.synra 判空，用于可能在非插件环境跑的代码 ──────────────────

export function requireSynra(): typeof synra {
  const client = window.synra
  if (!client) throw new Error('this page has to run in a Synra plugin context')
  return client
}

export async function sendIfAvailable(to: string): Promise<void> {
  await window.synra?.device.send({ to, event: 'chat.text', payload: { body: 'hi' } })
}

// ── 全局 Unsubscribe 可用，不需要 import ────────────────────────────────────

export function watch(): Unsubscribe {
  // The handler receives a payload this example does not use; naming it `_payload` is how the
  // codebase says "deliberately unused" rather than discarding it with a `void` expression.
  return synra.event.subscribe('_synra.device.changed', (_payload) => undefined)
}

// ── 三种"能不能"是不同的方法，混用会编译失败 ───────────────────────────────

export function availability(): {
  readonly granted: boolean
  readonly platformSupports: boolean
  readonly hostSupports: boolean
} {
  return {
    granted: synra.env.can('platform:open-url'),
    // Platform capabilities are a closed set, so a typo is a compile error rather than a `false`.
    platformSupports: synra.env.platformSupports('open_url'),
    hostSupports: synra.env.hostSupports('device.pick'),
  }
}

// ── 未实现的方法仍然存在，且返回一个可处理的错误而不是 TypeError ─────────────

export async function pickOrFallback(): Promise<string | null> {
  if (!synra.device.supported.includes('device.pick')) return null
  return synra.device.pick({ title: 'Where?' })
}

// ── 出网形状：三种读取方式是互斥的 Promise 方法 ─────────────────────────────

export async function fetchTitle(url: string): Promise<string> {
  const response = await synra.network.fetch(url, { method: 'GET', timeoutMs: 5_000 })
  if (!response.ok) return response.statusText
  return response.text()
}

// ── 错误是结构化对象，判别靠 `code` ─────────────────────────────────────────

export function describeFailure(error: unknown): string {
  if (synra.isSynraError(error)) {
    // `code` is narrowed to the union, so a comparison against a code that does not exist is a
    // compile error rather than a branch that never runs.
    if (error.code === 'capability_denied') return 'need permission'
    if (error.retryable) return 'retry later'
    return error.message
  }
  return 'unknown'
}

// ── 存储的 fallback 重载：给了 fallback 就没有 undefined ────────────────────

export async function readSetting(): Promise<number> {
  // No `?? 0` needed, because the overload returns `number` rather than `number | undefined`.
  return synra.storage.get('count', { fallback: 0 })
}

export async function readOptional(): Promise<number | undefined> {
  return synra.storage.get<number>('count')
}

// ── 事件名可以是模式，退订函数必须被调用 ────────────────────────────────────

export function subscribeAll(): () => void {
  const unsubscribe = synra.event.subscribe('_synra.*.*', () => undefined)
  return unsubscribe
}

// ── self.invoke 是泛型的，按 ActionDescriptor 断言 ──────────────────────────

export async function invokeSend(target: string): Promise<{ messageId: string }> {
  return synra.self.invoke<{ target: string }, { messageId: string }>('send-message', { target })
}