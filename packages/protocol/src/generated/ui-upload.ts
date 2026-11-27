import type { TransferId } from './wire'

/** Internal IPC between an injected page and its upload host. */
export interface PluginUploadBegin {
  readonly to: string
  readonly fileName: string
  readonly totalBytes: number
}

export interface PluginUploadOpened {
  readonly uploadId: string
  readonly chunkBytes: number
}

export interface PluginUploadChunk {
  readonly uploadId: string
  readonly offset: number
  readonly data: string
}

export interface PluginUploadAppend {
  readonly written: number
  readonly totalBytes: number
}

export interface PluginUploadHandle {
  readonly uploadId: string
}

export interface PluginUploadEnded {
  readonly aborted: boolean
}

export interface PluginUploadSent {
  readonly transferId: TransferId
}
