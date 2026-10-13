/**
 * 出网（`synra.network.fetch`）的形状。
 *
 * # 这个文件是"两侧共同的形状契约"
 *
 * 内核经 IPC 实现 `fetch`，宿主的注入脚本 `import type` 这里声明的同一份类型。所以这个文件
 * 是 `SynraResponse` 的**唯一**声明处 —— 在另一个仓库里再写一份同名接口就是"契约有两个来源"，
 * 而两份会漂移，漂移的表现是"宿主返回的形状与作者收到的类型不符"。
 *
 * # 为什么不用原生 `Response`
 *
 * 经 IPC 拿不到真正的 `Response` 实例：它的语义绑在流的惰性读取上，而一次 IPC 调用返回的是一
 * 个已经完整的值。硬造一个带 `body` 的对象会让人以为可以 `body.getReader()`，然后在真机上
 * 得到一个不是流的东西。
 *
 * 所以这里是自定义的 `SynraResponse`，字段与 `fetch` 的语义对齐（头名小写、`ok` 是 2xx、
 * 三种读取方式互斥），但读取方式是显式的 `Promise` 方法。
 */

/** 允许的请求方法。封闭列表：内核按它决定要不要带 body，也按它做白名单判断。 */
export type SynraFetchMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD'

/** 一次 `fetch` 的参数。 */
export interface SynraFetchInit {
  readonly method?: SynraFetchMethod
  /** 请求头。名字应当小写，与 HTTP/2 一致。 */
  readonly headers?: Readonly<Record<string, string>>
  /**
   * 请求体。
   *
   * 字符串或字节，不是流：一次 IPC 调用不能是一个流，而一个接受流的签名会让作者写一个传不进
   * 去的 `ReadableStream`。
   */
  readonly body?: string | Uint8Array
  /**
   * 超时，由**内核**强制。超出直接拒绝一个 `timeout`，不是让调用方自己计时 ——
   * 调用方计时的话，取消请求这一步做不到，连接会留在内核里。
   */
  readonly timeoutMs?: number
}

/**
 * 一次出网的响应。
 *
 * # 三种读取方式互斥
 *
 * 与 `fetch` 一致：读完一次就没有了，第二次调用会拒绝。写清楚是因为不写的话，作者会以为可以
 * 先 `text()` 再 `json()`。
 */
export interface SynraResponse {
  readonly status: number
  readonly statusText: string
  /** 头字段名统一**小写**，与 HTTP/2 和 `fetch` 一致。 */
  readonly headers: Readonly<Record<string, string>>
  /** 最终地址。发生重定向时是重定向后的地址。 */
  readonly url: string
  /** 状态码是 2xx。 */
  readonly ok: boolean
  /** 是否发生过重定向。 */
  readonly redirected: boolean

  /**
   * 读成文本。
   *
   * # Errors
   *
   * 已经读过一次时拒绝。
   */
  text(): Promise<string>
  /**
   * 读成 JSON。
   *
   * # Errors
   *
   * 已经读过一次，或内容不是合法 JSON 时拒绝。
   */
  json(): Promise<unknown>
  /**
   * 读成字节。
   *
   * # Errors
   *
   * 已经读过一次时拒绝。
   */
  bytes(): Promise<Uint8Array>
}

/**
 * 一次出网的错误码。
 *
 * 单独一个类型而不是 `ErrorCode` 的子集，是因为出网路径的失败原因在界面上要区别对待：被拦截
 * 的地址是配置问题，超时是网络问题，"响应太大"是插件自己的问题。塌缩成一个"出网失败"会让用
 * 户拿不到能行动的信息。
 */
export type SynraFetchErrorCode =
  | 'scheme_not_allowed'
  | 'host_not_allowed'
  | 'ip_not_allowed'
  | 'redirect_blocked'
  | 'response_too_large'
  | 'timeout'
