/** Registry workflow reasons from synra-ipc/src/dto/plugin/registry.rs. */
export type RegistryProblem
  = | { readonly kind: 'notConfigured' }
    | {
      readonly kind: 'invalidConfiguration'
      readonly field: string
      readonly index?: number
      readonly reason: string
    }
    | { readonly kind: 'searchUnsupported' }
