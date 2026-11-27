import type { SynraError } from '@synra/client'
import { expect } from 'vitest'

export async function expectCode(operation: Promise<unknown>, code: string): Promise<SynraError> {
  try {
    await operation
  }
  catch (error) {
    const typed = error as SynraError
    expect(typed.code).toBe(code)
    return typed
  }
  throw new Error(`expected a rejection with code ${code}, but the call resolved`)
}

export const devices = [
  { deviceId: 'dev_a', displayName: 'My PC', platform: 'linux' as const, online: true },
  { deviceId: 'dev_b', displayName: 'Laptop', platform: 'macos' as const, online: false },
]
