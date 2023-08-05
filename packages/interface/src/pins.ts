import type { GetBlockProgressEvents } from './blocks'
import type { AbortOptions } from '@libp2p/interface'
import type { CID } from 'multiformats/cid'
import type { ProgressEvent, ProgressOptions } from 'progress-events'

export type PinType = 'recursive' | 'direct' | 'indirect'

export interface Pin {
  cid: CID
  depth: number
  metadata: Record<string, any>
}

export type AddPinEvents =
  ProgressEvent<'helia:pin:add', CID>

export interface AddOptions extends AbortOptions, ProgressOptions<AddPinEvents | GetBlockProgressEvents> {
  /**
   * How deeply to pin the DAG, defaults to Infinity
   */
  depth?: number

  /**
   * Optional user-defined metadata to store with the pin
   */
  metadata?: Record<string, string | number | boolean>
}

export interface RmOptions extends AbortOptions {

}

export interface LsOptions extends AbortOptions {
  cid?: CID
}

export interface IsPinnedOptions extends AbortOptions {

}

export interface Pins {
  /**
   * Pin a block in the blockstore. It will not be deleted
   * when garbage collection is run.
   */
  add: (cid: CID, options?: AddOptions) => Promise<Pin>

  /**
   * Unpin the block that corresponds to the passed CID. The block will
   * be deleted when garbage collection is run.
   */
  rm: (cid: CID, options?: RmOptions) => Promise<Pin>

  /**
   * List all blocks that have been pinned.
   */
  ls: (options?: LsOptions) => AsyncGenerator<Pin, void, undefined>

  /**
   * Return true if the passed CID is pinned
   */
  isPinned: (cid: CID, options?: IsPinnedOptions) => Promise<boolean>
}
