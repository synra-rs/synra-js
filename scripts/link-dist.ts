#!/usr/bin/env tsx
/**
 * Lays out the built packages the way an install does.
 *
 * # Why this exists
 *
 * `types: ["@synra/client"]` is resolved by TypeScript as a **directory under a type root**, not
 * through module resolution. In a published install that directory is
 * `node_modules/@synra/client`, and it contains a `package.json` whose `types` points at the
 * declaration file.
 *
 * Inside the workspace, `node_modules/@synra/client` is a symlink to the source package — which has
 * no `dist` until it is built and whose `types` points into that `dist`. So the consumer type check
 * cannot read the workspace layout and has to read a laid-out copy. This script makes that copy from
 * the build output, which means the check is against what a publish would ship rather than against
 * the sources.
 *
 * # It is a copy, not a symlink
 *
 * A symlink would work on the machine that built it and behave differently elsewhere; a copy is the
 * same everywhere and cannot silently resolve back into the source tree.
 */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const jsRoot = resolve(here, '..')
const target = join(jsRoot, 'packages', 'client', 'type-tests', 'node_modules')

/** The packages the consumer check reads, and where their builds land. */
const PACKAGES = ['client', 'protocol', 'synra'] as const

function main(): void {
  rmSync(target, { recursive: true, force: true })
  mkdirSync(join(target, '@synra'), { recursive: true })

  let laidOut = 0
  for (const name of PACKAGES) {
    const source = join(jsRoot, 'packages', name)
    const dist = join(source, 'dist')
    if (!existsSync(dist)) {
      console.error(
        `✗ ${name} has no dist. Run \`pnpm run build\` first: the consumer check reads the built\n` +
          '  declarations, and checking the sources instead would not prove they ship.',
      )
      process.exit(1)
    }

    const manifest = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8')) as {
      readonly name: string
      readonly version: string
      readonly types?: string
      readonly exports?: Record<string, Record<string, string>>
    }

    // A type-only package must have no runtime entry. Asserted here as well as in `check-shapes.ts`
    // because this is the script that decides whether the check can run at all.
    if (manifest.exports?.['.']?.['import'] !== undefined) {
      console.error(`✗ ${manifest.name} declares a runtime entry and is supposed to be types only`)
      process.exit(1)
    }

    const directory =
      manifest.name.startsWith('@')
        ? join(target, ...manifest.name.split('/'))
        : join(target, manifest.name)
    mkdirSync(directory, { recursive: true })
    cpSync(dist, join(directory, 'dist'), { recursive: true })
    writeFileSync(
      join(directory, 'package.json'),
      `${JSON.stringify(
        {
          name: manifest.name,
          version: manifest.version,
          type: 'module',
          types: manifest.types ?? './dist/index.d.ts',
          exports: manifest.exports,
        },
        undefined,
        2,
      )}\n`,
      'utf8',
    )
    laidOut += 1
  }

  console.log(`✓ laid out ${laidOut} built package(s) for the consumer check`)
}

main()