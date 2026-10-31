/**
 * 禁用名单 —— **宿主与插件模板共用这一份**。
 *
 * # 为什么它在 preset 包里，而不是各写一份
 *
 * 只导出 `presetSynra()` 的后果是每个消费者各自抄一份名单。两份名单会在第一次"某个类不许用"时
 * 分叉，而分叉的后果是**插件里的字面颜色宿主看得见、宿主自己却看不见** —— 因为宿主那份更新了。
 * 所以它是 `synraConfig()` 的一部分，而不是配置里的几行。
 *
 * # 这些条目各自防的是什么
 *
 * | 条目 | 防的失效 |
 * | - | - |
 * | 物理方向（`ml-` / `pr-` / `text-left`） | 界面自称双语，而 RTL 进来时全量重排 |
 * | `uppercase` / `tracking-` | "生成的页面"的标志手法之一；它不承担任何信息 |
 * | `[#...]` 字面颜色 | **token 漂移的唯一入口**：一个 `text-[#fff]` 就绕开了整套颜色 |
 * | `z-[n]` / `rounded-[n]` / `duration-[n]` | 层级、圆角、时长都是**分层的 token**，不是可调参数 |
 * | `!` / `important-` | 一旦用上它，后面的规则就只能用更响的 `!` 去盖 |
 *
 * # 名单里没有的东西，以及为什么
 *
 * - **`backdrop-blur-*` 不在名单里**：它是允许的，只是只允许出现在**浮起的层**上。
 *   而"这个类出现在哪个文件里"不是名单能回答的问题 —— 那是宿主守卫的事（设计文档 28 §13.1 守卫 11）。
 * - **发光同理**：`shadow-glow` 是允许的，只是只允许出现在焦点环、那条线的活动态、主按钮按下态。
 */

import type { UserConfig } from 'unocss'

/** 一条禁用规则。类型从 `UserConfig` 取，所以它跟着 unocss 的版本走，而不是抄一份形状。 */
export type Blocklist = NonNullable<UserConfig['blocklist']>

/** 名单里的每一条都带 message：报错时要告诉人**换成什么**，而不是只说"不许"。 */
export const synraBlocklist: Blocklist = [
  [
    /^(?:m|p)[lr]-/,
    { message: '用逻辑属性（ms-/me-/ps-/pe-）：界面是双语的，物理方向的间距在 RTL 下会反' },
  ],
  [
    /^text-(?:left|right)$/,
    { message: '用 text-start / text-end' },
  ],
  [
    'uppercase',
    { message: '不要用全大写当小标签：它不承担信息，而且是最常见的模板化手法之一' },
  ],
  [
    /^tracking-/,
    { message: '不要为了区分层级而加字距：那是排版决策，不是默认手段' },
  ],
  [
    /^(?:bg|text|border|ring|outline|fill|stroke|decoration|shadow|from|via|to)-\[#/,
    { message: '颜色只能来自 token：加一个颜色就加一个 --synra-* 变量，不要在类里写字面值' },
  ],
  // ★ This message used to promise `z-panel / z-overlay / z-modal / z-toast / z-drag`. None of the five exists — no
  //   token in this package declares them and no template names them — so the rule rejected `z-[1001]` while the bare
  //   `z-50` it was meant to replace sailed through. Advice that points at nothing is worse than no advice: it makes
  //   the honest `z-<number>` look like the workaround.
  [
    /^z-\[/,
    { message: '层级不要写任意值（z-[…]）：用 UnoCSS 的 z-<数字>；要盖住 antd 弹层（1000）时用 z-[1001] 并在注释里写明理由' },
  ],
  [
    /^rounded-\[/,
    { message: '圆角是分层的（rounded-control / rounded-surface / rounded-pill），不要写任意值' },
  ],
  [
    /^(?:duration|delay)-\[/,
    { message: '时长用 token（duration-fast / duration-base / duration-slow）' },
  ],
  [
    /^!/,
    { message: '不要用 !important：一旦用上，后面就只能用更响的 ! 去盖' },
  ],
  [
    /^important-/,
    { message: '不要用 important- 变体：理由同上' },
  ],
]
