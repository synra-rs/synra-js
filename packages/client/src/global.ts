/**
 * 全局类型注入。
 *
 * ★ **不要**写 `import { synra } from "@synra/client"` —— 那是在 import 一个不存在的运行时
 * 绑定。本包里没有值，打包器会报错或产出 `undefined`。全局变量由宿主的初始化脚本注入，类型
 * 在这一句 `declare` 里。
 *
 * 三种写法都是同一个类型，按场景选：
 *
 * | 写法 | 何时用 |
 * | --- | --- |
 * | `synra.device.send(…)` | 默认。不用 import，不用判空 |
 * | `window.synra?.device.send(…)` | 同一份代码可能在插件页与预览/单测/宿主页都跑时 |
 * | `globalThis.synra` | 需要绕过局部变量遮蔽时（不推荐，但类型上支持） |
 */

import type { SynraClient } from './surface'

declare global {
  /**
   * 宿主注入的 Synra 客户端。
   *
   * ★ 由宿主的初始化脚本注入，在**插件的 UI 上下文**里必然存在。
   * 宿主自己的界面里它**不存在**（宿主走 Tauri command，不用这个对象），所以那段代码不该引用
   * 这个全局 —— 用 `window.synra?` 的那一支。
   */
  const synra: SynraClient

  interface Window {
    /**
     * 与全局 `synra` 是**同一个对象**。
     *
     * 可选，用于"可能不在插件里"的代码做安全判空。类型上与全局那个一致，所以判空之后拿到的是
     * 同一个 `SynraClient`，不需要转换。
     */
    readonly synra?: SynraClient
  }

  /**
   * 一次事件订阅的退订函数。
   *
   * 声明为全局是因为它出现在注释与签名里而不需要 import ——「订阅返回它」是本库最常被提到的
   * 约定，让作者为了写一个变量类型去 import 一个类型是没必要的摩擦。
   */
  type Unsubscribe = () => void
}

export {}
