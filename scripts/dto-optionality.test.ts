import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import { dtoOptionalityProblems, omittedDtoFields } from './dto-optionality'
import { createShapeContext } from './shapes/context'

const sample = `
pub struct Sample {
    /// Defaults do not mean that serialization omits a field.
    #[serde(default)]
    pub granted: Vec<String>,
    #[serde(
        default,
        skip_serializing_if = "Vec::is_empty"
    )]
    pub denied: Vec<String>,
    #[serde(rename = "lastError", skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
}
`

it('distinguishes omission from deserialization defaults and respects a renamed field', () => {
  expect(omittedDtoFields(sample).get('Sample')).toEqual(['denied', 'lastError'])
  expect(dtoOptionalityProblems(sample, 'export interface Sample { readonly granted: string[]; readonly denied?: string[]; readonly lastError?: string }')).toEqual([])
})

it('rejects a required or absent mirror field and ignores attribute text in comments', () => {
  const source = `${sample}\n// #[serde(skip_serializing_if = "Vec::is_empty")] pub ignored: Vec<String>,`
  expect(dtoOptionalityProblems(source, 'export interface Sample { readonly denied: string[] }')).toEqual([
    'Sample.denied can be omitted by serde and must be optional in TypeScript',
    'Sample.lastError can be omitted by serde and must be optional in TypeScript',
  ])
})

const dtoRoot = createShapeContext().dtoDirectory
const tsRoot = resolve('packages/protocol/src/generated')
const rust = readdirSync(dtoRoot).filter(name => name.endsWith('.rs')).map(name => readFileSync(resolve(dtoRoot, name), 'utf8')).join('\n')
const mirror = readdirSync(tsRoot).filter(name => name.endsWith('.ts')).map(name => readFileSync(resolve(tsRoot, name), 'utf8')).join('\n')

it('checks actual serialized DTO presence across the domain modules', () => {
  expect(dtoOptionalityProblems(rust, mirror)).toEqual([])
})

it.each(['denied', 'requested', 'addedCapabilities', 'candidates', 'warnings', 'failures', 'leftovers'])('detects the real omitted collection %s being marked required', (field) => {
  const changed = mirror.replace(`readonly ${field}?:`, `readonly ${field}:`)
  expect(changed).not.toBe(mirror)
  expect(dtoOptionalityProblems(rust, changed).some(problem => problem.includes(`.${field} `))).toBe(true)
})
