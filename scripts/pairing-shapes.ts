/** Check the task enum and exact nullable fields, not merely the presence of similarly named fields. */
export function pairingShapeProblems(rust: string, ts: string): string[] {
  const problems: string[] = []
  const variants = /pub enum PairingPhase\s*\{([\s\S]*?)\n\}/.exec(rust)?.[1]
  const union = /export type PairingPhase\s*=([\s\S]*?)(?:\n\n|$)/.exec(ts)?.[1]
  if (variants === undefined || union === undefined)
    return ['PairingPhase could not be read on both sides']
  const expected = [...variants.matchAll(/^\s*(\w+),/gm)].map(match => camel(match[1] ?? '')).sort()
  const actual = [...union.matchAll(/'([^']+)'/g)].map(match => match[1]).sort()
  if (expected.length === 0 || JSON.stringify(expected) !== JSON.stringify(actual))
    problems.push('PairingPhase variants differ')

  return [...problems, ...requiredRecordProblems(rust, ts, 'PairingSnapshot')]
}

/** Required nullable fields follow the actual Rust type; skipped Option fields are not supported here. */
export function requiredRecordProblems(rust: string, ts: string, name: string): string[] {
  const problems: string[] = []
  const rustFields = new RegExp(`pub struct ${name}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(rust)?.[1]
  const tsFields = new RegExp(`export interface ${name}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(ts)?.[1]
  if (rustFields === undefined || tsFields === undefined)
    return [`${name} could not be read on both sides`]
  if (/#\[serde\(/.test(rustFields))
    return [`${name} has unsupported field serialization attributes`]
  const fields = new Map([...tsFields.matchAll(/readonly (\w+)(\??): ([^\n]+)/g)]
    .map(match => [match[1], { optional: match[2] === '?', type: match[3]?.trim().replace('import(\'./wire\').', '') }]))
  const expectedFields = [...rustFields.matchAll(/pub (\w+): ([^,\n]+),/g)]
  if (expectedFields.length === 0 || fields.size !== expectedFields.length)
    problems.push(`${name} field counts differ`)
  for (const match of expectedFields) {
    const fieldName = camel(match[1] ?? '')
    const type = rustType(match[2] ?? '')
    const field = fields.get(fieldName)
    if (type === undefined || field === undefined || field.optional || field.type !== type)
      problems.push(`${name}.${fieldName} must be required with type ${type ?? 'unknown'}`)
  }
  return problems
}

function camel(value: string): string {
  return value.replace(/^./, first => first.toLowerCase())
    .replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
}

function rustType(value: string): string | undefined {
  const optional = /^Option<(.+)>$/.exec(value)?.[1]
  if (optional !== undefined) {
    const inner = rustType(optional)
    return inner === undefined ? undefined : `${inner} | null`
  }
  return ({ 'RequestId': 'string', 'DeviceId': 'string', 'String': 'string', 'i64': 'number', 'PairingPhase': 'PairingPhase', 'crate::ErrorCode': 'ErrorCode', 'ErrorCode': 'ErrorCode', 'u32': 'number', 'bool': 'boolean', 'CredentialEnrollment': 'CredentialEnrollment', 'CredentialCleanupReport': 'CredentialCleanupReport' } as Record<string, string>)[value]
}
