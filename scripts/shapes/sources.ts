import { readdirSync } from 'node:fs'
import { join } from 'node:path'

/** The recursive Rust source tree used by DTO coverage and serialization-presence tests. */
export function rustSourceFiles(root: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory())
      files.push(...rustSourceFiles(path))
    else if (entry.name.endsWith('.rs'))
      files.push(path)
  }
  return files
}
