/**
 * The parsers behind the shape check, against text written the way each side really writes it.
 *
 * # Why the parsers and not the checks
 *
 * `check-shapes` compares two languages by reading both as text, and every comparison depends on a regular expression
 * finding something. The callers guard the cases that matter — an empty Rust list fails, a missing convention fails — but
 * those guards are only reached if the parser *returns*, and what it returns is what the guard inspects.
 *
 * A parser that quietly matched the wrong thing would move a real disagreement into the "agrees" column, and this file is
 * where that is decided. The fixtures are written to look like the real declarations, including the parts the patterns
 * rely on: four-space indentation, a trailing comma, `rename_all` on the line above.
 */

import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { evaluateProduct, kernelCandidates, rustConvention, rustErrorCodes, tsErrorCodes } from './check-shapes'

describe('kernelCandidates', () => {
  // 期望值用 `join` 拼，因为这个函数返回的就是平台自己的分隔符：在 Windows 上写死 `/a/b`
  // 会让这三条测试只在 CI 上通过、在开发机上失败——而那种测试的下一步是被跳过。
  it('prefers the named root, then beside the repository, then inside it', () => {
    const root = join('/work', 'synra-js')
    expect(kernelCandidates(root, '/core')).toEqual([
      '/core',
      join('/work', 'synra-rust-core'),
      join(root, 'synra-rust-core'),
    ])
  })

  // ★ 这一条就是那个已经漏过一次的 bug。`actions/checkout` 只能把内核放进工作区**里面**
  // （放到工作区之外会被拒绝），而候选里原先只有"旁边"那一个——于是 CI 的对照一直静默跳过，
  // 而绿色的摘要和"从未对照过"的摘要在输出里长得一样。
  it('includes the layout actions/checkout produces', () => {
    const root = join('/work', 'synra-js')
    expect(kernelCandidates(root, undefined)).toContain(join(root, 'synra-rust-core'))
  })

  // 一个空的 SYNRA_CORE_ROOT 是"没给"，不是"找当前目录"：空路径会被 existsSync 判成真，
  // 于是所有对照都对着工作目录跑一遍，全部报成"内核里没有这个类型"。
  it('drops an empty SYNRA_CORE_ROOT rather than looking in the empty path', () => {
    expect(kernelCandidates(join('/work', 'synra-js'), '')).not.toContain('')
  })
})

describe('rustErrorCodes', () => {
  it('reads the variants and writes them the way the wire does', () => {
    const source = [
      'pub enum ErrorCode {',
      '    DeviceOffline,',
      '    TlsHandshakeFailed,',
      '    EcdsaSignatureInvalid,',
      '}',
    ].join('\n')

    expect(rustErrorCodes(source)).toEqual(['device_offline', 'tls_handshake_failed', 'ecdsa_signature_invalid'])
  })

  // The case two-regex camel-to-snake conversion gets wrong most often: a run of capitals followed by a word. `TLSHandshake`
  // has to become `tls_handshake`, not `t_l_s_handshake` and not `tlshandshake`.
  it('splits an acronym from the word after it', () => {
    const source = ['pub enum ErrorCode {', '    TLSHandshake,', '    HTTPServerRefused,', '}'].join('\n')

    expect(rustErrorCodes(source)).toEqual(['tls_handshake', 'http_server_refused'])
  })

  it('leaves digits attached, because that is how the variants are spelled', () => {
    const source = ['pub enum ErrorCode {', '    Sha256Missing,', '    FrameTooLarge,', '}'].join('\n')

    expect(rustErrorCodes(source)).toEqual(['sha256_missing', 'frame_too_large'])
  })

  // ★ The three ways a parser can find nothing. Each must return an empty list rather than a plausible one, because the
  // caller turns an empty list into a failure — and a non-empty wrong list into silence.
  it('finds nothing when the enum is absent, renamed, or indented differently', () => {
    expect(rustErrorCodes('pub enum SomethingElse {\n    A,\n}')).toEqual([])
    expect(rustErrorCodes('pub enum ErrorCode {}')).toEqual([])
    // Two-space indentation is what a differently-formatted crate would look like, and it must not be read as a variant.
    expect(rustErrorCodes('pub enum ErrorCode {\n  DeviceOffline,\n}')).toEqual([])
  })
})

describe('tsErrorCodes', () => {
  const wire = [
    'export type ErrorCode =',
    "  | 'device_offline'",
    "  | 'tls_handshake_failed'",
    '',
    'export type Other =',
    "  | 'not_an_error_code'",
  ].join('\n')

  it('reads the union and stops at the blank line', () => {
    expect(tsErrorCodes(wire)).toEqual(['device_offline', 'tls_handshake_failed'])
  })

  it('finds nothing when the declaration is absent', () => {
    // The caller fails on every expected code when this is empty, so empty is the safe answer and a wrong guess is not.
    expect(tsErrorCodes('export type Something = 1')).toEqual([])
  })
})

describe('rustConvention', () => {
  const source = [
    '#[derive(Serialize)]',
    '#[serde(rename_all = "kebab-case")]',
    'pub struct DeviceId(String);',
    '',
    '#[serde(rename_all = "snake_case")]',
    'pub struct ErrorCode {',
    '    A,',
    '}',
  ].join('\n')

  it('takes the convention on the type the name asks for', () => {
    expect(rustConvention(source, 'DeviceId')).toBe('kebab-case')
    expect(rustConvention(source, 'ErrorCode')).toBe('snake_case')
  })

  // ★ The reason the window looks backwards rather than forwards: a `rename_all` after the declaration belongs to the next
  // type, and reading it would report a convention the type does not have — a false failure, which reads as the code's
  // fault rather than the guard's.
  it('does not take a convention that belongs to a later type', () => {
    const only = '#[serde(rename_all = "kebab-case")]\npub struct WithOne(String);\n\npub struct WithoutOne(String);'

    expect(rustConvention(only, 'WithoutOne')).toBeNull()
  })

  it('is null when the type is absent altogether', () => {
    expect(rustConvention(source, 'NoSuchType')).toBeNull()
  })
})

describe('evaluateProduct', () => {
  it('multiplies the factors a constant is written as', () => {
    expect(evaluateProduct('8 * 1024 * 1024')).toBe(8_388_608)
    expect(evaluateProduct('16 * 1024 * 1024')).toBe(16_777_216)
    expect(evaluateProduct('1024')).toBe(1024)
  })

  // ★ Not zero. A parse failure that returned a number would compare equal to a constant that happened to be zero, and a
  // guard that reads a value it could not parse is worse than one that refuses.
  it('is NaN for anything that is not a product of integer literals', () => {
    expect(evaluateProduct('8 * 1_024')).toBeNaN()
    expect(evaluateProduct('SIZE')).toBeNaN()
    expect(evaluateProduct('8 + 1024')).toBeNaN()
    expect(evaluateProduct('0x10')).toBeNaN()
    expect(evaluateProduct('')).toBeNaN()
  })
})
