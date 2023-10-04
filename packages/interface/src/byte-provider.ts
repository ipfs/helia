import type { AbortOptions } from '@libp2p/interface'
import type { CID } from 'multiformats/cid'
import type { ProgressEvent, ProgressOptions } from 'progress-events'

export type ByteProviderProgressEventError = ProgressEvent<'helia:byte-provider:error', Error>
export type ByteProviderProgressEventRequest = ProgressEvent<'helia:byte-provider:request', CID>
export type ByteProviderProgressEventSuccess = ProgressEvent<'helia:byte-provider:success', CID>

export type ByteProviderEvents =
  ByteProviderProgressEventRequest |
  ByteProviderProgressEventSuccess |
  ByteProviderProgressEventError

export interface ByteProviderGetOptions extends AbortOptions, ProgressOptions<ByteProviderEvents> {

}

export interface ByteProvider extends ProgressOptions<ByteProviderEvents> {
  /**
   * Get some bytes from the byte provider
   */
  get: (cid: CID, options?: ByteProviderGetOptions) => Promise<Uint8Array>
}
