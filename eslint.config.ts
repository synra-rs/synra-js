/**
 * Lint rules for this repository.
 *
 * `@antfu/eslint-config` — the same config the other repositories in this project use — so a rule
 * that earns its place here is written the same way it is written there. It also formats: ESLint's
 * `--fix` is the only formatter in this repository, which is why there is no Prettier.
 *
 * ★ **Type-aware rules are on.** `tsconfig.lint.json` covers every file in the repository, so a
 * script or a test is linted with the same type information as the source it reads. The build's
 * per-package projects cannot cover them, which is the whole reason that project exists.
 */
import antfu from '@antfu/eslint-config'

export default antfu(
  {
    type: 'lib',

    // ★ Markdown is off rather than configured. `markdown: true` extracts each code fence into a
    // virtual file (`README.md\2_2.ts`), and **no `tsconfig` can name that path**, so the parser
    // fails on a file that does not exist on disk. The docs repository turns it off for the same
    // reason.
    markdown: false,

    // ★ **TOML is off, for the same reason as in `synra-rust-app`: this repository has no TOML of its own.**
    //   The only `.toml` files eslint could ever see are the checked-out kernel's — another project's
    //   manifests, owned by another toolchain, linted by this one. A rule that can only ever be right by
    //   accident is worth one line to remove (`toml/array-element-newline` is what it reported there).
    toml: false,

    typescript: {
      tsconfigPath: './tsconfig.lint.json',

      // ★ **The project service cannot cover this repository, so the legacy `project` is used.**
      //
      // The service discovers projects **by the file name `tsconfig.json`**. This repository's root
      // one is a solution file (references only), and each package's covers just its own `src/` — so
      // a script, a test or a `vitest.config.ts` belongs to no project at all. Its fallback,
      // `allowDefaultProject`, is capped at **8 files** and we have twenty-odd, so raising it is not
      // an option. `tsconfig.lint.json` exists exactly for this: one project that covers every file,
      // which the legacy option takes directly.
      //
      // The cost is written down rather than hidden: the legacy path type-checks through a program
      // instead of the incremental service, so linting is slower. The alternative was seven more
      // `tsconfig.json` files (one per `test/` directory plus `scripts/`), which is seven more places
      // for "which project covers this file" to be answered differently.
      parserOptions: {
        projectService: false,
        project: ['./tsconfig.lint.json'],
      },
    },

    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      // Generated from the Rust kernel by `scripts/gen-protocol-types.ts`. Linting it as hand-written
      // code is noise; §6 守卫 3 compares it against the kernel instead.
      'packages/protocol/src/generated/**',
      // The install layout `scripts/link-dist.ts` lays out for the consumer type check.
      'packages/client/type-tests/node_modules/**',
      // ★ **The kernel is checked out *into* this repository by `release.yaml`**, so that `check-shapes`
      //   can compare against it (that workflow's `path:` has to be inside the workspace —
      //   `actions/checkout` refuses to write outside it). It is **tooling input, not part of this
      //   repository**: without this line `eslint .` lints another project's files, and the release
      //   failed with **320 errors in `synra-rust-core/**`'s `Cargo.toml`s**. Nobody sees that
      //   locally, because there is no checkout here — the same shape as the `pnpm install` failure
      //   that preceded it.
      'synra-rust-core/**',
    ],
  },

  {
    // ★ **This block has to come after `antfu()`'s own configs, which is why it is a separate item.**
    //
    // The `rules` option above is merged *before* the TypeScript block that enables this rule, so
    // turning it off there does nothing — measured, not assumed: the error below survived that
    // attempt. A config item passed after `antfu(…)` is applied last, so it wins.
    //
    // Two reasons to turn it off, either one sufficient:
    //   ① the name **does not resolve against the installed plugin** — ESLint reports
    //      `Definition for rule '@typescript-eslint/prefer-promise-reject-errors' was not found` on
    //      every file that would trigger it, which is an upstream version skew rather than our
    //      mistake;
    //   ② this repository does not want the rule anyway — the client's errors are **structured
    //      objects rather than `Error` subclasses** (doc 23: `code` is what a caller branches on), so
    //      a rejection carrying one is deliberate.
    rules: {
      'prefer-promise-reject-errors': 'off',
      '@typescript-eslint/prefer-promise-reject-errors': 'off',

      // ★ **`ts/method-signature-style` is off, against this config's preference for `foo: () => T`.**
      //
      // The client's surface declares **overloads** — `storage.get(key)` and
      // `storage.get(key, { fallback })` return different types — and the property form cannot express
      // them. `--fix` collapsed the pair into one optional-parameter signature, and the mock stopped
      // satisfying `SynraClient`; the consumer type check (`pnpm run types:consumer`) is what caught
      // it, which is why that check exists. Method signatures are also how doc 23 writes the surface,
      // and that document is the contract the plugins are written against.
      'ts/method-signature-style': 'off',

      // ★ **`pnpm/yaml-enforce-settings` is off, because it does not lint the file — it writes pnpm
      //   settings into it.** `--fix` added three lines to `pnpm-workspace.yaml`
      //   (`trustPolicy: no-downgrade`, `shellEmulator: true`, `minimumReleaseAgeExcludePrune`), and
      //   those change how dependencies resolve and how `pnpm run` executes scripts. That is a
      //   decision about the build, not about lint, so it does not belong in a lint autofix.
      //
      //   (`shellEmulator: true` is the one with a real payoff here: `clean` runs `rm -rf dist`, which
      //   needs a POSIX shell on Windows. Adopting it deliberately is a separate change — recorded in
      //   design-docs 25 §7.1.)
      'pnpm/yaml-enforce-settings': 'off',
    },
  },
)
