import ts from 'typescript'

/** Serialized field omissions, rather than Rust defaults for deserialization. */
export function omittedDtoFields(rust: string): Map<string, string[]> {
  const source = rust.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const result = new Map<string, string[]>()
  for (const record of source.matchAll(/pub struct (\w+)\s*\{([^}]*)\}/g)) {
    const fields: string[] = []
    for (const field of record[2]!.matchAll(/((?:\s*#\[[\s\S]*?\])*)\s*pub\s+(\w+)\s*:/g)) {
      if (!field[1]!.includes('skip_serializing_if'))
        continue
      const renamed = /rename\s*=\s*"([^"]+)"/.exec(field[1]!)?.[1]
      fields.push(renamed ?? field[2]!.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()))
    }
    if (fields.length)
      result.set(record[1]!, fields)
  }
  return result
}

/** A field that serde can omit must not be promised as always present in TS. */
export function dtoOptionalityProblems(rust: string, mirror: string): string[] {
  const interfaces = new Map<string, Map<string, boolean>>()
  const source = ts.createSourceFile('mirror.ts', mirror, ts.ScriptTarget.Latest, true)
  for (const statement of source.statements) {
    if (!ts.isInterfaceDeclaration(statement))
      continue
    const fields = new Map<string, boolean>()
    for (const member of statement.members) {
      if (ts.isPropertySignature(member) && (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name)))
        fields.set(member.name.text, member.questionToken !== undefined)
    }
    interfaces.set(statement.name.text, fields)
  }
  const problems: string[] = []
  for (const [name, fields] of omittedDtoFields(rust)) {
    for (const field of fields) {
      if (interfaces.get(name)?.get(field) !== true)
        problems.push(`${name}.${field} can be omitted by serde and must be optional in TypeScript`)
    }
  }
  return problems
}
