import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createShapeContext } from './shapes/context'
import { checkDtos } from './shapes/dto'

describe('dto coverage across generated modules', () => {
  it('compares every actual DTO with the split TypeScript mirrors', () => {
    const context = createShapeContext()
    checkDtos(context)
    expect(context.problems).toEqual([])
    expect(context.evidence.some(line => line.startsWith('dto-coverage: Rust '))).toBe(true)
  })

  it.each([
    ['ui-diagnostics.ts', 'DiagExportResult'],
    ['ui-diagnostics.ts', 'ProbeResultDto'],
    ['ui-diagnostics.ts', 'ProbeReportDto'],
    ['ui-activity.ts', 'IntentRetry'],
    ['ui-activity.ts', 'ReceivedFile'],
    ['ui-plugins.ts', 'PublisherDto'],
    ['ui-plugins.ts', 'InstallReport'],
    ['ui-plugins.ts', 'InstallPreviewDto'],
  ])('detects a missing interface in %s: %s', (module, name) => {
    const context = createShapeContext()
    const path = join(context.jsRoot, 'packages/protocol/src/generated', module)
    const source = context.read(path)
    const changed = source.replace(`export interface ${name} {`, `export interface Removed${name} {`)
    expect(changed).not.toBe(source)
    const read = context.read
    context.read = candidate => candidate === path ? changed : read(candidate)

    checkDtos(context)
    expect(context.problems.some(problem =>
      problem.where === 'dto-coverage' && problem.what.includes(`${name} 在内核里声明了`),
    )).toBe(true)
  })

  it.each([
    ['ui-activity.ts', 'IntentSnapshot', 'traceId', 'trace_id'],
    ['ui-activity.ts', 'IntentSnapshot', 'retry', 'retry'],
    ['ui-plugins.ts', 'PluginSnapshot', 'dataPath', 'data_path'],
    ['ui-plugins.ts', 'PluginSnapshot', 'stateReason', 'state_reason'],
    ['ui-plugins.ts', 'PluginSnapshot', 'hasUi', 'has_ui'],
    ['ui-plugins.ts', 'PluginSnapshot', 'requested', 'requested'],
    ['ui-plugins.ts', 'PluginSnapshot', 'updateCheckedAtMs', 'update_checked_at_ms'],
    ['ui-plugins.ts', 'UpdateInfo', 'pluginId', 'plugin_id'],
    ['ui-plugins.ts', 'CatalogQuery', 'offset', 'offset'],
    ['ui-plugins.ts', 'CatalogQuery', 'sort', 'sort'],
  ])('detects field drift in %s: %s.%s', (module, name, field, rustField) => {
    const context = createShapeContext()
    const path = join(context.jsRoot, 'packages/protocol/src/generated', module)
    const source = context.read(path)
    const changed = source.replaceAll(`readonly ${field}`, `readonly removed${field}`)
    expect(changed).not.toBe(source)
    const read = context.read
    context.read = candidate => candidate === path ? changed : read(candidate)

    checkDtos(context)
    expect(context.problems.some(problem =>
      problem.where === 'dto-coverage' && problem.what.includes(`${name} 在 Rust 里声明了 ${rustField}`),
    )).toBe(true)
  })
})
