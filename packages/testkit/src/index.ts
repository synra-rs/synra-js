/** Policy-aware local client; native effects require explicit fixtures and host integration tests. */
export { createMockClient, MockSynraClient } from './client.js'
export { synraError } from './error-constructor.js'
export { matches } from './events.js'
export type { RecordedCall } from './execution.js'
export { createMockResponse } from './network.js'
export type { MockOptions } from './options.js'
export { APP_PROFILE, SIMULATED_PROFILE } from './profile.js'
export type { MockHostProfile } from './profile.js'
