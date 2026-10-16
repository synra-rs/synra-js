/**
 * `./unocss` 这一层的守卫。
 *
 * # 为什么其中一条是端到端跑生成器
 *
 * 其余断言看的是我们**声明**了什么，而这条看的是 UnoCSS **实际产出**了什么。两者的差别正是
 * "presetWind3 的 reset 有没有漏进来"这类问题所在：我们写了 `preflight: 'tokens'`，但那个开关
 * 只管**我们自己的**那一段 —— Tailwind 的 reset 来自嵌套的 preset，而它会一起被打进 `preflights`。
 * 官网的排版能不能活，取决于那一份没漏进来，而这件事只有生成一次 CSS 才知道。
 */

import type { Preset } from 'unocss'
import type { PreflightTier } from '../src/index.js'
import { createGenerator } from 'unocss'

import { describe, expect, it } from 'vitest'
import { colors, glass } from '../src/index.js'
import { presetSynra, structuralShortcuts, synraBlocklist, synraConfig, synraTheme, synraThemeColors } from '../src/unocss/index.js'

function kebab(key: string): string {
  return key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
}

/** 取某个档位的 preflight 文本。我们的 `getCSS` 是同步的，而类型允许返回 Promise。 */
function preflightOf(tier: PreflightTier): string {
  const getCSS = presetSynra({ preflight: tier }).preflights?.[0]?.getCSS as unknown as
    | (() => string | undefined)
    | undefined
  return getCSS?.() ?? ''
}

describe('presetSynra', () => {
  it('names itself synra', () => {
    expect(presetSynra().name).toBe('synra')
  })

  // ★ 单一真相源的机械形式：每个颜色都映射到一个变量，而不是一个色值。于是改一支紫只改一处。
  it('maps every token colour to var(--synra-<kebab-key>)', () => {
    const mapped = synraThemeColors()

    for (const key of Object.keys(colors)) {
      const name = kebab(key)
      expect(mapped[name], name).toBe(`var(--synra-${name})`)
    }
  })

  it('carries the material tokens through', () => {
    const theme = synraTheme()
    const mapped = synraThemeColors()

    expect(mapped.glass).toBe('var(--synra-glass)')
    expect(mapped['glass-base']).toBe('var(--synra-glass-base)')
    // 玻璃的基底必须指向一个**真的不透明颜色**，否则对比度那一对会对着一个不是颜色的东西算比值。
    expect(Object.values(colors)).toContain(glass.base)
    // 一个模糊半径：玻璃的"厚度"是材质，不是可调参数。
    expect(Object.keys(theme.blur)).toHaveLength(1)
    expect(Object.keys(theme.boxShadow)).toHaveLength(1)
  })
})

describe('the preflight tiers', () => {
  it('emits the reset only in the app tier', () => {
    const app = preflightOf('app')
    const tokens = preflightOf('tokens')

    expect(app).toContain('body {')
    expect(app).toContain('--synra-surface')
    // ★ 官网只能吃这一档：一个 body 或 * 就足以打散 VitePress 的排版。
    expect(tokens).not.toContain('body')
    expect(tokens).not.toContain('html')
    expect(tokens).toContain('--synra-surface')
  })

  it('emits nothing at all in the none tier', () => {
    expect(preflightOf('none')).toBe('')
  })

  it('defaults to the app tier', () => {
    const getCSS = presetSynra().preflights?.[0]?.getCSS as unknown as () => string | undefined
    expect(getCSS()).toContain('body {')
  })
})

describe('the generated CSS', () => {
  it('reads the variables the preflight declares, and carries no Tailwind reset', async () => {
    const uno = await createGenerator(synraConfig())
    const { css } = await uno.generate(
      'bg-surface text-ink-dim rounded-surface z-modal shadow-glow floating focusable',
      { preflights: true },
    )

    // 工具类读变量，变量由同一份 token 发出 —— 这是"工具类与 CSS 变量是同一条声明"。
    // 断言照抄生成器真实的输出格式（UnoCSS 在声明里不写冒号后的空格）。
    expect(css).toContain('background-color:var(--synra-surface)')
    expect(css).toContain('--synra-surface: #14101f')
    expect(css).toContain('z-index:30')

    // 玻璃：模糊半径来自 token，saturate 只在这个 shortcut 里出现。
    expect(css).toContain('backdrop-filter')
    expect(css).toContain('var(--synra-blur)')
    expect(css).toContain('saturate(1.4)')
    expect(css).toContain('--synra-glass-base')

    // ★ 这一条是"官网能用"的守卫：Tailwind 的 reset 一旦漏进来，它带着 `border-width: 0`
    //   （`*, ::before, ::after`）而我们的 reset 没有这一句。
    expect(css).not.toContain('border-width: 0')
  })
})

describe('synraBlocklist', () => {
  /**
   * 名单里的匹配器有**三种**形态：字符串、正则，以及一个函数（unocss 允许用它做更复杂的判断）。
   * 只处理前两种会让第三种静默地永远不匹配。
   */
  function matches(className: string): boolean {
    return synraBlocklist.some((entry) => {
      const matcher = Array.isArray(entry) ? entry[0] : entry
      if (typeof matcher === 'string') {
        return matcher === className
      }
      if (matcher instanceof RegExp) {
        return matcher.test(className)
      }
      return matcher(className) === true
    })
  }

  /** 给断言用的可读标签：正则用 source，函数没有名字就写出来。 */
  function labelOf(entry: (typeof synraBlocklist)[number]): string {
    const matcher = Array.isArray(entry) ? entry[0] : entry
    if (typeof matcher === 'string') {
      return matcher
    }
    return matcher instanceof RegExp ? matcher.source : '(function)'
  }

  // 正向与**负向**都在这里：只测"这些被拦"会漏掉"那个正则把一切都拦了"，而那种名单会让
  // `synraConfig()` 变成一份用不了的配置。
  it('blocks what it says it blocks, and nothing else', () => {
    const blocked = [
      'uppercase',
      'tracking-wide',
      'ml-4',
      'pr-2',
      'text-left',
      'text-right',
      'bg-[#fff]',
      'text-[#22d3ee]',
      'border-[#000]',
      'z-[99]',
      'rounded-[12px]',
      'duration-[600ms]',
      'delay-[100ms]',
      '!p-4',
      'important-p-4',
    ]
    for (const className of blocked) {
      expect(matches(className), `${className} 应该被拦`).toBe(true)
    }

    const allowed = [
      'ms-4',
      'me-2',
      'ps-3',
      'pe-1',
      'text-start',
      'text-end',
      'bg-surface',
      'text-primary-ink',
      'border-line',
      'z-modal',
      'rounded-surface',
      'duration-base',
      'bg-glass',
      'backdrop-blur-synra',
      'shadow-glow',
      'focusable',
    ]
    for (const className of allowed) {
      expect(matches(className), `${className} 不该被拦`).toBe(false)
    }
  })

  it('carries a message on every entry, so the fix is named', () => {
    for (const entry of synraBlocklist) {
      expect(Array.isArray(entry), labelOf(entry)).toBe(true)
      const meta = Array.isArray(entry) ? entry[1] : undefined
      expect(meta?.message, labelOf(entry)).toBeTruthy()
    }
  })
})

describe('structuralShortcuts', () => {
  // ★ 预算：这个名字列表就是"什么算结构原语"的答案。加一个名字要改这里，于是"加"是一次显式
  //   决定 —— 而一份没有预算的 shortcuts 表会稳步长成一套组件库，只是没写在组件里。
  it('is exactly the structural primitives', () => {
    expect(Object.keys(structuralShortcuts as Record<string, string>).sort()).toEqual([
      'floating',
      'focusable',
      'panel',
      'row',
      'row-between',
      'screen',
      'stack',
    ])
  })

  it('has no visual components', () => {
    const names = Object.keys(structuralShortcuts)
    for (const component of ['card', 'btn', 'button', 'badge', 'chip', 'input', 'alert', 'avatar', 'tooltip']) {
      expect(names).not.toContain(component)
    }
  })

  // ★ 这条守卫是为了**那个已经犯过一次的错**。
  //
  //   `focus-ring` 这个短名字被 UnoCSS 解析成 `focus` 变体 + `ring` 工具类
  //   （`.focus-ring:focus{--un-ring-width:3px}`），于是 shortcut 被静默遮蔽：生成的是 `:focus`
  //   （鼠标点一下也亮环）而不是 `:focus-visible`，而那个名字看起来完全正常。
  //
  //   判据不看名字（"哪些前缀危险"是一张永远不全的名单），看**展开结果**：shortcut 会把 body 的
  //   全部声明合进一个块，所以"body 展开出的每一条声明"都必须出现在"用名字展开"的 CSS 里。
  //   被遮蔽时一条都不会出现（而巧合相同的那几条 —— 比如 ring 的 offset-shadow 链 —— 不足以让它通过，
  //   因为 `ring-2` 与内建 `ring` 的宽度不同）。
  it('every shortcut expands to its own body rather than being shadowed', async () => {
    const uno = await createGenerator(synraConfig({ icons: false }))
    const shadowed: string[] = []

    for (const [name, body] of Object.entries(structuralShortcuts as Record<string, string>)) {
      const fromName = (await uno.generate(name, { preflights: false })).css
      const fromBody = (await uno.generate(body, { preflights: false })).css
      // 只取**花括号内部**：选择器（`.flex`）在 shortcut 里会变成 `.row`，不是我们要对的东西。
      const declarations = [...fromBody.matchAll(/\{([^}]*)\}/g)]
        .flatMap(match => (match[1] ?? '').split(';'))
        .map(part => part.trim())
        .filter(part => part !== '')

      const missing = declarations.filter(declaration => !fromName.includes(declaration))
      if (missing.length > 0) {
        shadowed.push(`${name}: 少了 ${missing.slice(0, 2).join(' / ')}`)
      }
    }

    expect(shadowed).toEqual([])
  })

  // 焦点环不能省，而且必须是 `:focus-visible`：`outline-none` 而没有替代是这类界面里最容易犯的
  // 可访问性错误，而"能看见但鼠标点一下也亮"是它的近亲。
  it('keeps a keyboard-only focus ring', async () => {
    const uno = await createGenerator(synraConfig({ icons: false }))
    const { css } = await uno.generate('focusable', { preflights: false })

    expect(css).toContain('outline:2px solid transparent')
    expect(css).toContain(':focus-visible')
    expect(css).toContain('--un-ring-width:2px')
    // `:focus` 单独出现（不带 `-visible`）就说明短路又变成了内建规则的影子。
    expect(css).not.toMatch(/:focus(?!-visible)/)
  })
})

describe('synraConfig', () => {
  it('carries the blocklist, which a preset cannot', () => {
    expect(synraConfig().blocklist).toBe(synraBlocklist)
  })

  // 图标必须构建期内联。在 `@unocss/preset-icons@66` 里 `cdn?: string` —— 只有一个 URL，
  // 没有"关掉"的布尔值；**不设它**就是"不取 CDN"。所以断言是"整个 options 里没有 cdn"，
  // 而不是"cdn 是 false"（后者在 v66 里连类型都过不了）。
  it('declares no runtime icon CDN', () => {
    // `presets` 的类型允许工厂、Promise 与嵌套数组；我们给的是已经构造好的 preset，所以这里收窄一次。
    const presets = (synraConfig().presets ?? []) as Preset[]
    const icon = presets.find(preset => preset.name === '@unocss/preset-icons')
    expect(icon).toBeDefined()

    // `cdn` 若被设过就在 preset 自己的 options 包里（它也是 `cdn: 'https://…'` 那种写法的落点）。
    // 断言**只看 options**，不看整个 preset —— 后者的 `docs` 字段本身就是一条 https 链接。
    const options = (icon as { options?: Record<string, unknown> } | undefined)?.options ?? {}
    expect(Object.keys(options)).not.toContain('cdn')
    expect(JSON.stringify(options)).not.toContain('http')
  })

  it('can leave the icons out', () => {
    const presets = (synraConfig({ icons: false }).presets ?? []) as Preset[]
    expect(presets.some(preset => preset.name === '@unocss/preset-icons')).toBe(false)
  })
})
