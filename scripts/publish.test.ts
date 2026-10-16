/**
 * The publish order, against a graph that is easy to get wrong and the real one.
 *
 * # Why the real workspace is one of the tests
 *
 * Because the synthetic cases prove the algorithm and say nothing about the packages. The graph in `packages/` is the one a
 * release actually walks, and it is the one that will be wrong the day somebody adds a dependency — so a test that reads it
 * from disk fails when the ordering stops matching reality, rather than when somebody remembers to update a fixture.
 */

import type { PackageInfo } from './publish'

import { describe, expect, it } from 'vitest'
import { fromArgument, OrderError, publishOrder, readWorkspace, resumeFrom } from './publish'

/** A package, with the fields the ordering does not use filled in. */
function pkg(name: string, dependsOn: string[] = [], published = true): PackageInfo {
  return { name, directory: `packages/${name.replace('@synra/', '')}`, published, dependsOn }
}

/** Asserts that every package appears after the ones it depends on. */
function assertRespects(order: readonly string[], packages: readonly PackageInfo[]): void {
  const position = new Map(order.map((name, index) => [name, index]))
  for (const entry of packages) {
    for (const dependency of entry.dependsOn) {
      const after = position.get(entry.name)
      const before = position.get(dependency)
      if (after === undefined || before === undefined) {
        continue
      }
      expect(
        before,
        `${dependency} must be published before ${entry.name}, but the order is ${order.join(', ')}`,
      ).toBeLessThan(after)
    }
  }
}

describe('publishOrder', () => {
  it('puts a dependency before the package that depends on it', () => {
    const packages = [pkg('@synra/client', ['synra', '@synra/protocol']), pkg('synra'), pkg('@synra/protocol')]

    const order = publishOrder(packages)

    expect(order.indexOf('synra')).toBeLessThan(order.indexOf('@synra/client'))
    expect(order.indexOf('@synra/protocol')).toBeLessThan(order.indexOf('@synra/client'))
    assertRespects(order, packages)
  })

  it('is stable, so a rehearsal predicts the release', () => {
    // ★ Two packages with no relationship between them must not swap places between runs. A release rehearsal prints an
    // order; if that order differs from the one the real run produces, the rehearsal has told the operator nothing.
    const packages = [pkg('@synra/b'), pkg('@synra/a'), pkg('@synra/c')]

    expect(publishOrder(packages)).toEqual(publishOrder(packages))
    expect(publishOrder(packages)).toEqual(publishOrder([...packages].reverse()))
  })

  it('refuses a cycle rather than breaking it', () => {
    // ★ A cycle has no valid order, and both ways of producing one anyway are worse than stopping: picking a package first
    // publishes a version whose dependency is missing — the failure this script exists to prevent — and picking one at
    // random makes the order differ between runs.
    const packages = [pkg('@synra/a', ['@synra/b']), pkg('@synra/b', ['@synra/a'])]

    expect(() => publishOrder(packages)).toThrow(OrderError)
    try {
      publishOrder(packages)
    }
    catch (error) {
      // And the message names the loop, so the operator knows which two files to look at.
      expect((error as OrderError).message).toContain('@synra/a')
      expect((error as OrderError).message).toContain('@synra/b')
    }
  })

  it('leaves a private package out of the order', () => {
    // ★ A made-up name rather than a real one, and the first version of this test was the reason: it used
    // `@synra/testkit` and asserted it was private, which is **false**. `25 §2.4` publishes testkit — it is the one package
    // with a runtime, and plugin authors install it as a `devDependency` — so the test was asserting a belief about this
    // project rather than a property of the ordering, and it failed the moment it read the real manifests.
    const packages = [pkg('@synra/client'), pkg('@synra/internal-tools', ['@synra/client'], false)]

    const order = publishOrder(packages)

    expect(order).toContain('@synra/client')
    expect(order).not.toContain('@synra/internal-tools')
  })

  it('ignores a dependency outside the workspace', () => {
    // `serde`-shaped: somebody else's package has its own release, and requiring it here would mean this script could never
    // be satisfied.
    const packages = [pkg('@synra/a', ['some-other-package', 'node:fs'])]

    expect(publishOrder(packages)).toEqual(['@synra/a'])
  })

  it('puts the real workspace in an order its own manifests allow', () => {
    // ★ The graph the release actually walks, read from disk rather than described here.
    const packages = readWorkspace(new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/i, '$1'))
    expect(packages.length).toBeGreaterThan(0)

    const order = publishOrder(packages)

    assertRespects(order, packages)
    // And the two leaves come before the package that needs them, which is the specific mistake the design records.
    const client = order.indexOf('@synra/client')
    expect(order.indexOf('synra')).toBeLessThan(client)
    expect(order.indexOf('@synra/protocol')).toBeLessThan(client)
    // And every package is in it. `25 §2.4` publishes testkit deliberately — it is the one package that
    // carried a runtime first — so "it is excluded" is not the property to check.
    expect(order).toContain('@synra/testkit')
    expect(order).toContain('@synra/theme')
    // ★ testkit depends on the other three, so it must come **after each of them**. This used to read
    // `expect(order.at(-1)).toBe('@synra/testkit')` — "it is last" — which held only until a package
    // whose directory name sorts after `testkit` was added (`theme` does: `te` vs `th`). A position is
    // not the property; the ordering against its own dependencies is.
    for (const dependency of ['@synra/client', '@synra/protocol', 'synra']) {
      expect(order.indexOf(dependency)).toBeLessThan(order.indexOf('@synra/testkit'))
    }
    // 而 theme 一条依赖边都没有，所以它的位置不受约束 —— 这也正是"它能独立发版"的机械形式：
    // 它不 re-export 那四个包里的任何一个，那四个也不依赖它。
    expect(packages.find(entry => entry.name === '@synra/theme')?.dependsOn).toEqual([])
  })
})

describe('resumeFrom', () => {
  const order = ['@synra/protocol', 'synra', '@synra/client']

  it('keeps the named package and everything after it', () => {
    expect(resumeFrom(order, 'synra')).toEqual(['synra', '@synra/client'])
  })

  it('resuming from the first package is the whole order', () => {
    expect(resumeFrom(order, '@synra/protocol')).toEqual(order)
  })

  // ★ The control, and the one that matters. The dangerous reading of an unknown name is "nothing matched, so publish
  // everything" — a full re-publish at the moment the operator believes they are resuming, against a registry that
  // cannot withdraw a version.
  it('refuses a name that is not in the order rather than publishing everything', () => {
    expect(() => resumeFrom(order, '@synra/typo')).toThrow(OrderError)
    expect(() => resumeFrom(order, '@synra/typo')).toThrow(/not in the publish order/)
  })

  it('refuses an empty order, which has no place to resume from', () => {
    expect(() => resumeFrom([], 'synra')).toThrow(OrderError)
  })

  // A private package never reaches the registry, so it cannot be a point a release resumes from — and it is the case a
  // name-based lookup would otherwise find in the workspace and accept.
  it('refuses a package that is in the workspace but private', () => {
    const packages = [pkg('@synra/protocol'), pkg('@synra/private', [], false), pkg('@synra/client', ['@synra/protocol'])]
    const real = publishOrder(packages)

    expect(real).not.toContain('@synra/private')
    expect(() => resumeFrom(real, '@synra/private')).toThrow(OrderError)
  })

  it('accepts every name the real workspace order contains', () => {
    // A resume point the operator reads off a rehearsal has to work, so each of them is checked rather than assumed.
    const order = publishOrder(readWorkspace(process.cwd()))

    expect(order.length).toBeGreaterThan(0)
    for (const name of order) {
      expect(resumeFrom(order, name)).toEqual(order.slice(order.indexOf(name)))
    }
  })
})

describe('fromArgument', () => {
  it('reads the name after the flag', () => {
    expect(fromArgument(['node', 'publish.ts', '--publish', '--from', 'synra'])).toBe('synra')
  })

  it('is undefined when the flag was not given, which means the whole order', () => {
    expect(fromArgument(['node', 'publish.ts', '--publish'])).toBeUndefined()
  })

  // The same trap as an unknown name, one step earlier: a bare `--from` must not mean "start at the beginning".
  it('refuses a flag with no value', () => {
    expect(() => fromArgument(['node', 'publish.ts', '--from'])).toThrow(OrderError)
  })

  it('refuses a value that is another flag', () => {
    expect(() => fromArgument(['node', 'publish.ts', '--from', '--publish'])).toThrow(OrderError)
  })
})
