/**
 * Publishing the workspace in dependency order.
 *
 * # Why this exists
 *
 * `release: bumpp -r` bumps every version and stops there. Publishing was left to whoever ran it, in whatever order they
 * chose — and the order is not a detail: `@synra/client` depends on `synra` and `@synra/protocol`, so publishing the client
 * first puts a version on the registry whose dependencies are not there yet. The failure lands on a **consumer**, who gets
 * `No matching version found for synra@0.1.1` from a release that reported success.
 *
 * # Why the ordering is a separate function
 *
 * Because it is the part that can be wrong in silence. A publish loop that walks the packages in directory order looks
 * exactly like one that walks them in dependency order until someone installs the result — so the ordering is pure, takes a
 * graph, and is asserted against both a synthetic one and the real workspace in `publish.test.ts`.
 *
 * # What this does not do
 *
 * It does not bump versions, and it does not publish unless asked. `--publish` is opt-in because publishing is not
 * reversible: a version that reaches the registry cannot be withdrawn, only deprecated. The default run prints the order and
 * exits, which is what a release rehearsal needs.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/** One package in the workspace. */
export interface PackageInfo {
  /** The name as the registry spells it, e.g. `@synra/client`. */
  readonly name: string
  /** The directory it lives in, relative to the workspace root. */
  readonly directory: string
  /** Whether it is published at all. A private package is not. */
  readonly published: boolean
  /** The names of the other workspace packages it depends on. */
  readonly dependsOn: readonly string[]
}

/** Why an order could not be produced. */
export class OrderError extends Error {
  constructor(
    message: string,
    /** The packages involved, so a caller can name them rather than the whole workspace. */
    readonly involved: readonly string[],
  ) {
    super(message)
    this.name = 'OrderError'
  }
}

/**
 * The order to publish in: every package after the ones it depends on.
 *
 * # Why a cycle is refused rather than broken
 *
 * Because a cycle has no valid order, and the two ways to produce one anyway are both worse than stopping. Picking an
 * arbitrary package first puts a version on the registry whose dependency is missing — the exact failure this exists to
 * prevent — and picking one at random makes the output differ between runs, so a rehearsal would not predict the release.
 *
 * A `devDependency` does not count: a package's *tests* needing another one is not a reason for consumers to install it in
 * an order. Only `dependencies` and `peerDependencies` put a version in somebody else's `node_modules`.
 *
 * @throws OrderError when the graph has a cycle.
 */
export function publishOrder(packages: readonly PackageInfo[]): string[] {
  const published = packages.filter((entry) => entry.published)
  const byName = new Map(published.map((entry) => [entry.name, entry]))
  const order: string[] = []
  const placed = new Set<string>()
  const visiting = new Set<string>()
  const path: string[] = []

  const visit = (entry: PackageInfo): void => {
    if (placed.has(entry.name)) {
      return
    }
    if (visiting.has(entry.name)) {
      // The cycle, from where it was entered, so the message names the loop rather than the whole graph.
      const from = path.indexOf(entry.name)
      throw new OrderError(
        `these packages depend on each other, so no publish order exists: ${[...path.slice(from), entry.name].join(' -> ')}`,
        [...path.slice(from), entry.name],
      )
    }
    visiting.add(entry.name)
    path.push(entry.name)
    for (const dependency of entry.dependsOn) {
      // A dependency outside the workspace is somebody else's package and has its own release.
      const inner = byName.get(dependency)
      if (inner) {
        visit(inner)
      }
    }
    path.pop()
    visiting.delete(entry.name)
    placed.add(entry.name)
    order.push(entry.name)
  }

  // Sorted first so the output is stable: two packages with no relationship must not swap places between runs, or a
  // rehearsal and the release itself could differ.
  for (const entry of [...published].sort((left, right) => left.directory.localeCompare(right.directory))) {
    visit(entry)
  }
  return order
}

/** Reads the workspace's packages from disk. */
export function readWorkspace(root: string): PackageInfo[] {
  const packagesDir = join(root, 'packages')
  const found: PackageInfo[] = []
  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue
    }
    const manifest = join(packagesDir, entry.name, 'package.json')
    if (!existsSync(manifest)) {
      continue
    }
    const parsed = JSON.parse(readFileSync(manifest, 'utf8')) as {
      name?: string
      private?: boolean
      dependencies?: Record<string, string>
      peerDependencies?: Record<string, string>
    }
    if (!parsed.name) {
      throw new OrderError(`${manifest} has no name`, [entry.name])
    }
    const declared = { ...parsed.dependencies, ...parsed.peerDependencies }
    found.push({
      name: parsed.name,
      directory: `packages/${entry.name}`,
      // `private: true` is how a package says it is not for the registry. `testkit` is one, and publishing it would be a
      // mistake nobody notices until somebody installs it.
      published: parsed.private !== true,
      dependsOn: Object.keys(declared).filter((name) => name === 'synra' || name.startsWith('@synra/')),
    })
  }
  return found
}

/** Publishes one package, or prints what it would run. */
function publish(root: string, entry: PackageInfo, execute: boolean): void {
  const args = ['--filter', entry.name, 'publish', '--access', 'public', '--no-git-checks']
  if (!execute) {
    process.stdout.write(`would run: pnpm ${args.join(' ')}\n`)
    return
  }
  execFileSync('pnpm', args, { cwd: root, stdio: 'inherit' })
}

function main(): void {
  const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
  const execute = process.argv.includes('--publish')
  const packages = readWorkspace(root)
  const order = publishOrder(packages)
  const byName = new Map(packages.map((entry) => [entry.name, entry]))

  if (!execute) {
    process.stdout.write('publish order (pass --publish to run it):\n')
  }
  for (const name of order) {
    const entry = byName.get(name)
    if (entry) {
      publish(root, entry, execute)
    }
  }
  // Named, because "published 3 packages" leaves out the one that was skipped for being private, and a release that quietly
  // omitted a package is a release somebody has to reconstruct later.
  const skipped = packages.filter((entry) => !entry.published).map((entry) => entry.name)
  if (skipped.length > 0) {
    process.stdout.write(`not published (private): ${skipped.join(', ')}\n`)
  }
}

// Only when run as a program, so importing the ordering from a test does not publish anything.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main()
  } catch (error) {
    if (error instanceof OrderError) {
      process.stderr.write(`publish: ${error.message}\n`)
      process.exit(1)
    }
    throw error
  }
}
