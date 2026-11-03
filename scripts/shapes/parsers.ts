import { join } from 'node:path'

const KERNEL_DIRECTORY = 'synra-rust-core'

export function kernelCandidates(root: string, coreRoot: string | undefined): string[] {
  return [coreRoot, join(root, '..', KERNEL_DIRECTORY), join(root, KERNEL_DIRECTORY)].filter(
    (candidate): candidate is string => candidate !== undefined && candidate !== '',
  )
}

export function rustConvention(source: string, typeName: string): string | null {
  const declaration = new RegExp(`pub (?:struct|enum) ${typeName}\\b`).exec(source)
  if (declaration === null)
    return null
  const before = source.slice(Math.max(0, declaration.index - 4_000), declaration.index)
  const matches = [...before.matchAll(/#\[serde\([^)]*rename_all = "([a-zA-Z_-]+)"/g)]
  // ★ A convention belongs to this type only if no other type is declared between it and this one.
  //
  // The first version took the nearest preceding match, on the reasoning that it sits adjacent to the declaration. That
  // holds when a type has a convention, and fails when it does not: the previous type's is then the nearest one, and it is
  // read as this type's. The caller's "this type has no `rename_all`" failure was therefore unreachable in that case, so
  // the guard could report a convention the type does not have — and, worse, call it agreement when the neighbour's
  // happened to match the table. A test written to pin this behaviour is what found it.
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index]
    if (match === undefined) {
      continue
    }
    const after = before.slice((match.index ?? 0) + match[0].length)
    if (!/pub (?:struct|enum)\s/.test(after)) {
      return match[1] ?? null
    }
  }
  return null
}

/** TS 侧 `ErrorCode` 的取值。 */
export function tsErrorCodes(wire: string): string[] {
  const start = wire.indexOf('export type ErrorCode =')
  if (start < 0)
    return []
  const end = wire.indexOf('\n\n', start)
  const block = wire.slice(start, end < 0 ? undefined : end)
  return [...block.matchAll(/'([a-z_]+)'/g)].flatMap(match =>
    match[1] === undefined ? [] : [match[1]],
  )
}

/** Rust 侧 `ErrorCode` 的变体，转成 `snake_case`。 */
export function rustErrorCodes(source: string): string[] {
  const declaration = /pub enum ErrorCode\s*\{([\s\S]*?)\n\}/.exec(source)
  const body = declaration?.[1]
  if (body === undefined)
    return []
  const names = [...body.matchAll(/^\s{4}([A-Z][A-Za-z0-9]*),/gm)].flatMap(match =>
    match[1] === undefined ? [] : [match[1]],
  )
  return names.map(name =>
    name
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
      .toLowerCase(),
  )
}

/**
 * Evaluates a product of integer literals, which is the only shape the constants are written in.
 *
 * Written out rather than using `eval` or `Function`: a guard that executes text from a file is a guard
 * whose own correctness has to be reasoned about, and the shapes here are a handful of digits and
 * asterisks.
 */
export function evaluateProduct(expression: string): number {
  let total = 1
  for (const factor of expression.split('*')) {
    const digits = factor.trim()
    if (!/^\d+$/.test(digits))
      return Number.NaN
    total *= Number.parseInt(digits, 10)
  }
  return total
}
