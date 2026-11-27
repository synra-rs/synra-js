/** Core DSL parsing and matching. Rust producer vectors calibrate this local precheck. */
const DOMAINS = new Set(['log', 'event', 'device', 'storage', 'network', 'fs', 'file', 'platform', 'action', 'ui'])

export function parseCapability(text: string): readonly string[] | undefined {
  // Only ASCII is accepted, so a valid input's character count is its byte count.
  if (text.length > 256)
    return undefined
  const parts = text.split(':')
  if (parts.length > 6 || !DOMAINS.has(parts[0] ?? '') || parts.some(part => part.length === 0))
    return undefined
  for (let index = 1; index < parts.length; index++) {
    const part = parts[index]
    if (part === undefined)
      return undefined
    if (part === '*' || part === '**')
      continue
    if (index === 1 ? !/^[a-z]/.test(part) || part.length > 64 || /[^a-z0-9-]/.test(part) : /[^\w.@/*-]/.test(part))
      return undefined
  }
  return parts
}

function segmentMatches(pattern: string, candidate: string): boolean {
  if (pattern === candidate || pattern === '*')
    return true
  if (pattern.endsWith('**'))
    return candidate.startsWith(pattern.slice(0, -2))
  if (pattern.endsWith('*')) {
    const stem = pattern.slice(0, -1)
    return candidate.startsWith(stem) && !/[/.]/.test(candidate.slice(stem.length))
  }
  return false
}

function matches(pattern: readonly string[], candidate: readonly string[]): boolean {
  if (pattern[0] !== candidate[0])
    return false
  let p = 1
  let c = 1
  let star: { pattern: number, consumed: number } | undefined
  while (c < candidate.length) {
    const segment = pattern[p]
    const target = candidate[c]
    if (segment === '**') {
      star = { pattern: p, consumed: c }
      p++
    }
    else if (segment !== undefined && target !== undefined && segmentMatches(segment, target)) {
      p++
      c++
    }
    else if (star !== undefined) {
      p = star.pattern + 1
      c = ++star.consumed
    }
    else {
      return false
    }
  }
  return pattern.slice(p).every(part => part === '**')
}

/** Invalid grants are refused at construction, invalid queries return false. No universal grant shortcut. */
export class CapabilityPolicy {
  private readonly grants: readonly (readonly string[])[]

  constructor(capabilities: readonly string[]) {
    this.grants = [...new Set(capabilities)].map((text) => {
      const parsed = parseCapability(text)
      if (parsed === undefined)
        throw new TypeError(`invalid capability: ${text}`)
      return parsed
    })
  }

  can(text: string): boolean {
    const candidate = parseCapability(text)
    return candidate !== undefined && this.grants.some(grant => matches(grant, candidate))
  }

  /** Each usable fetch grant explicitly names the destination. */
  canFetch(host: string, method: string): boolean {
    const destination = ['network', 'fetch', host]
    const operation = [...destination, method]
    return this.grants.some(grant => grant[0] === 'network' && grant[1] === 'fetch' && grant[2] === host
      && (matches(grant, destination) || matches(grant, operation)))
  }
}
