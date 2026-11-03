import process from 'node:process'
/** Run each contract and package check, then report every failure together. */
import { createShapeContext } from './shapes/context'
import { checkDistribution } from './shapes/distribution'
import { checkDtos } from './shapes/dto'
import { checkPackages } from './shapes/packages'
import { checkProtocol } from './shapes/protocol'
import { checkTheme } from './shapes/theme'

const context = createShapeContext()
for (const check of [checkProtocol, checkDtos, checkPackages, checkTheme, checkDistribution])
  check(context)
if (context.problems.length) {
  console.error(`\n✗ shape check failed with ${context.problems.length} problem(s):\n`)
  for (const problem of context.problems)
    console.error(`  ${problem.where}\n    ${problem.what}`)
  process.exit(1)
}
console.log(`✓ shapes agree (${context.evidence.length} checks)`)
for (const line of context.evidence)
  console.log(`  · ${line}`)
