import type { AbortOptions } from '@libp2p/interface'
import type { CID } from 'multiformats/cid'
import type { ProgressEvent, ProgressOptions } from 'progress-events'

export type BlockProviderProgressEventError = ProgressEvent<'helia:byte-provider:error', Error>
export type BlockProviderProgressEventRequest = ProgressEvent<'helia:byte-provider:request', CID>
export type BlockProviderProgressEventSuccess = ProgressEvent<'helia:byte-provider:success', CID>

export type BlockProviderEvents =
  BlockProviderProgressEventRequest |
  BlockProviderProgressEventSuccess |
  BlockProviderProgressEventError

export interface BlockProviderGetOptions extends AbortOptions, ProgressOptions<BlockProviderProgressEventError | BlockProviderProgressEventSuccess> {

}

export interface BlockProvider extends ProgressOptions<BlockProviderEvents> {
  /**
   * Get a block from the byte provider
   */
  get: (cid: CID, options?: BlockProviderGetOptions) => Promise<Uint8Array>
}
