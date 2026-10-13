// A flat config, because ESLint 9 and later use one. Kept small on purpose: these packages are types
// plus one mock, so the rules that earn their place are the ones catching a mistake the compiler
// cannot see.
import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'packages/protocol/src/generated/**',
      'packages/client/type-tests/node_modules/**',
      // Plain JavaScript: it is not in the lint project, because a file with no type information has
      // nothing to give the type-aware rules.
      'eslint.config.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // One project covers every file in the repository, so a test or a script is linted with the
        // same type information as the source. The build's per-package projects cannot cover them.
        project: ['./tsconfig.lint.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Throwing a non-Error loses the `code` a caller branches on, and the client's errors are
      // structured objects rather than `Error` subclasses, so `only-throw-error` would have to be
      // turned off at every throw site. Off globally, with the intent recorded here.
      '@typescript-eslint/only-throw-error': 'off',
      // `any` is banned by the type library's own rules; the lint enforces the same here.
      '@typescript-eslint/no-explicit-any': 'error',
      // The codebase's convention for a parameter that exists to satisfy a signature is a leading
      // underscore, which is exactly what this option names.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // A generic on a *declared* interface method is the feature rather than a redundancy: the rule
      // catches a parameter that could be replaced by `unknown`, and here the caller supplies the type.
      // Removing it would take away the ergonomics the client library exists to provide, and a mock
      // implementing that interface has to carry the same parameter.
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',
    },
  },
  {
    // The mock implements interfaces whose methods are `async` by contract — the host's IPC calls are
    // asynchronous — so an implementation that resolves immediately still has to be declared `async`
    // to satisfy the interface. `require-await` cannot see the interface.
    //
    // `no-unnecessary-type-parameters` fires on the same shape: a signature is generic because the
    // *interface* is, and the parameter appears in a position the rule does not count. Removing it
    // would make the mock not satisfy `SynraClient`, which is the property the package exists for.
    files: ['packages/testkit/src/**/*.ts'],
    rules: {
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',
      '@typescript-eslint/no-meaningless-void-operator': 'off',
      // `Promise<void>` is the interface's return type and the rule objects to `void` as a generic
      // argument.
      '@typescript-eslint/no-invalid-void-type': 'off',
    },
  },
  {
    // A generic parameter on a *declared* interface method is the feature, not a redundancy: the rule
    // exists to catch a parameter that could be replaced by `unknown`, and here the caller supplies the
    // type. Removing it would take away the ergonomics the client library exists to provide.
    files: ['packages/client/src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',
    },
  },
  {
    files: ['scripts/**/*.ts'],
    rules: {
      // These scripts read files and JSON they did not write, so the parsed shapes are `unknown` and
      // a handful of narrowings are unavoidable.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },
  {
    // The test assertions compare against values the mock produced, so the narrowings there are the
    // same story as the mock's own.
    files: ['packages/*/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
)