import type { Blockstore } from 'interface-blockstore'
import type { AbortOptions } from 'interface-store'
import type { BitswapNotifyProgressEvents, BitswapWantProgressEvents } from 'ipfs-bitswap'
import type { CID } from 'multiformats/cid'
import type { ProgressEvent, ProgressOptions } from 'progress-events'

export interface Pair {
  cid: CID
  block: Uint8Array
}

export type HasBlockProgressEvents =
  ProgressEvent<'blocks:put:duplicate', CID> |
  ProgressEvent<'blocks:put:providers:notify', CID> |
  ProgressEvent<'blocks:put:blockstore:put', CID> |
  BitswapNotifyProgressEvents

export type PutBlockProgressEvents =
  ProgressEvent<'blocks:put:duplicate', CID> |
  ProgressEvent<'blocks:put:providers:notify', CID> |
  ProgressEvent<'blocks:put:blockstore:put', CID> |
  BitswapNotifyProgressEvents

export type PutManyBlocksProgressEvents =
  ProgressEvent<'blocks:put-many:duplicate', CID> |
  ProgressEvent<'blocks:put-many:providers:notify', CID> |
  ProgressEvent<'blocks:put-many:blockstore:put-many'> |
  BitswapNotifyProgressEvents

export type GetBlockProgressEvents =
  ProgressEvent<'blocks:get:providers:want', CID> |
  ProgressEvent<'blocks:get:blockstore:get', CID> |
  ProgressEvent<'blocks:get:blockstore:put', CID> |
  BitswapWantProgressEvents

export type GetManyBlocksProgressEvents =
  ProgressEvent<'blocks:get-many:blockstore:get-many'> |
  ProgressEvent<'blocks:get-many:providers:want', CID> |
  ProgressEvent<'blocks:get-many:blockstore:put', CID> |
  BitswapWantProgressEvents

export type GetAllBlocksProgressEvents =
  ProgressEvent<'blocks:get-all:blockstore:get-many'>

export type DeleteBlockProgressEvents =
  ProgressEvent<'blocks:delete:blockstore:delete', CID>

export type DeleteManyBlocksProgressEvents =
  ProgressEvent<'blocks:delete-many:blockstore:delete-many'>

export interface GetOfflineOptions {
  /**
   * If true, do not attempt to fetch any missing blocks from the network (default: false)
   */
  offline?: boolean
}

export interface Blocks extends Blockstore<ProgressOptions<HasBlockProgressEvents>,
ProgressOptions<PutBlockProgressEvents>, ProgressOptions<PutManyBlocksProgressEvents>,
GetOfflineOptions & ProgressOptions<GetBlockProgressEvents>, GetOfflineOptions & ProgressOptions<GetManyBlocksProgressEvents>, ProgressOptions<GetAllBlocksProgressEvents>,
ProgressOptions<DeleteBlockProgressEvents>, ProgressOptions<DeleteManyBlocksProgressEvents>
> {

}

export interface BlockRetriever<GetProgressOptions extends ProgressOptions = ProgressOptions> {
  /**
   * Retrieve a block from a source
   */
  retrieve(cid: CID, options?: AbortOptions & GetProgressOptions): Promise<Uint8Array>
}

export interface BlockAnnouncer<NotifyProgressOptions extends ProgressOptions = ProgressOptions> {
  /**
   * Make a new block available to peers
   */
  announce(cid: CID, block: Uint8Array, options?: NotifyProgressOptions): void
}

export type BlockBroker = BlockRetriever | BlockAnnouncer
