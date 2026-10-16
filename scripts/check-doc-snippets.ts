/**
 * Guard 8: the code in the client library's design document has to compile.
 *
 * # Why this exists
 *
 * The document is what an author copies. `23-client-library.md` §8 is a complete Vue page written the way a plugin author
 * is told to write one — `synra` global, no import, `Unsubscribe`, progressive enhancement around `device.pick` — and
 * nothing compiled it. Every other guard in this repository checks the **code**; this is the only one that checks the
 * thing the code is explained with, which is the artifact that drifts silently: a rename lands in `surface.ts`, the
 * document keeps the old name, and the first person to find out is an author following it.
 *
 * # What is checked, and what is not
 *
 * ★ The **complete example** (§8), not every fenced block. Most blocks in that document are fragments — two lines showing
 * a call, an interface sketch, a deliberately-wrong spelling — and a fragment is not a program, so compiling one would
 * mean inventing the surrounding code. A guard that has to guess what the author meant reports on its own guess.
 *
 * The line is: a block that claims to be a whole file. §8 is introduced as "完整示例" and is fenced ```vue, which is a
 * file type rather than a language fragment.
 *
 * # Why it skips rather than fails without the sibling repository
 *
 * The document lives in `synra-rs/design-docs`, which is its own repository. CI checks it out beside this one when it
 * can, and the same reasoning as `check-shapes.ts` applies: a checkout that failed must be visible as "this check did not
 * run", not as "the document is wrong". The note says which happened.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const jsRoot = dirname(here)

/** The document, and the section that is a complete file rather than a fragment. */
const DOCUMENT = join(jsRoot, '..', 'design-docs', '23-client-library.md')

/** The fence that marks the complete example. */
const EXAMPLE_FENCE = 'vue'

/**
 * The `<script setup>` body of the complete example.
 *
 * Returns `undefined` when the document has no such block, which is a failure of its own: the point of checking the
 * example is that it exists, and a check that passes because it found nothing to check is the shape this repository keeps
 * finding in other people's guards.
 */
function completeExample(markdown: string): string | undefined {
  const lines = markdown.split('\n')
  const start = lines.findIndex(line => line.trim() === `\`\`\`${EXAMPLE_FENCE}`)
  if (start === -1)
    return undefined

  const end = lines.findIndex((line, index) => index > start && line.trim() === '```')
  if (end === -1)
    return undefined

  const block = lines.slice(start + 1, end).join('\n')
  const scriptOpen = block.indexOf('<script setup lang="ts">')
  if (scriptOpen === -1)
    return undefined
  const scriptClose = block.indexOf('</script>', scriptOpen)
  if (scriptClose === -1)
    return undefined

  return block.slice(scriptOpen + '<script setup lang="ts">'.length, scriptClose).trim()
}

/**
 * What `vue` has to be for this to compile.
 *
 * A shim rather than a dependency: the example uses three of Vue's functions, and installing the framework to check nine
 * lines would put a build of it on every CI run. The shim is deliberately **loose** — it does not model Vue, it declares
 * the three names the example imports — because a shim that was precise enough to be wrong would make this guard report
 * on the shim.
 */
const VUE_SHIM = `
declare module 'vue' {
  export function ref<T>(value: T): { value: T }
  export function onMounted(fn: () => void | Promise<void>): void
  export function onUnmounted(fn: () => void): void
}
`

if (!existsSync(DOCUMENT)) {
  console.log('  · doc-snippets: the design-docs repository is not beside this one, so nothing was compiled')
  process.exit(0)
}

const example = completeExample(readFileSync(DOCUMENT, 'utf8'))
if (example === undefined) {
  console.error(`✗ doc-snippets: ${join('..', 'design-docs', '23-client-library.md')} has no \`\`\`${EXAMPLE_FENCE} block with a <script setup> to compile`)
  process.exit(1)
}

// ★ The type root is the layout `link-dist.ts` produces, so the example is checked against the **built** declarations —
// the state an author's install is in, not the source.
const typeRoots = join(jsRoot, 'packages', 'client', 'type-tests', 'node_modules')
if (!existsSync(join(typeRoots, '@synra', 'client'))) {
  console.error('✗ doc-snippets: the built packages are not laid out yet; `pnpm run types:consumer` has to run first')
  process.exit(1)
}

const scratch = mkdtempSync(join(tmpdir(), 'synra-doc-snippet-'))
try {
  writeFileSync(join(scratch, 'example.ts'), example)
  writeFileSync(join(scratch, 'vue-shim.d.ts'), VUE_SHIM)
  writeFileSync(
    join(scratch, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'bundler',
          strict: true,
          noEmit: true,
          // ★ Not `noUnusedLocals`: an example may import a type to *show* the import, and reporting that as an error
          // would make the document harder to write for no gain in correctness.
          skipLibCheck: true,
          types: ['@synra/client'],
          typeRoots: [typeRoots],
          baseUrl: '.',
          paths: { vue: ['./vue-shim.d.ts'] },
        },
        include: ['.'],
      },
      null,
      2,
    )}\n`,
  )

  try {
    execFileSync('pnpm', ['exec', 'tsc', '-p', join(scratch, 'tsconfig.json')], {
      cwd: jsRoot,
      stdio: 'pipe',
      encoding: 'utf8',
    })
    console.log('  · doc-snippets: the complete authoring example in 23 §8 compiles')
  }
  catch (error) {
    const output = error as { stdout?: string, stderr?: string }
    console.error('✗ doc-snippets: the example in 23 §8 does not compile:')
    console.error(output.stdout ?? '')
    console.error(output.stderr ?? '')
    process.exit(1)
  }
}
finally {
  rmSync(scratch, { recursive: true, force: true })
}
