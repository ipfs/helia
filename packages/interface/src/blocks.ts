import type { Blockstore } from 'interface-blockstore'
import type { AbortOptions } from 'interface-store'
import type { CID } from 'multiformats/cid'
import type { ProgressEvent, ProgressOptions } from 'progress-events'

export interface Pair {
  cid: CID
  block: Uint8Array
}

export type HasBlockProgressEvents =
  ProgressEvent<'blocks:put:duplicate', CID> |
  ProgressEvent<'blocks:put:providers:notify', CID> |
  ProgressEvent<'blocks:put:blockstore:put', CID>

export type PutBlockProgressEvents =
  ProgressEvent<'blocks:put:duplicate', CID> |
  ProgressEvent<'blocks:put:providers:notify', CID> |
  ProgressEvent<'blocks:put:blockstore:put', CID>

export type PutManyBlocksProgressEvents =
  ProgressEvent<'blocks:put-many:duplicate', CID> |
  ProgressEvent<'blocks:put-many:providers:notify', CID> |
  ProgressEvent<'blocks:put-many:blockstore:put-many'>

export type GetBlockProgressEvents =
  ProgressEvent<'blocks:get:providers:want', CID> |
  ProgressEvent<'blocks:get:blockstore:get', CID> |
  ProgressEvent<'blocks:get:blockstore:put', CID>

export type GetManyBlocksProgressEvents =
  ProgressEvent<'blocks:get-many:blockstore:get-many'> |
  ProgressEvent<'blocks:get-many:providers:want', CID> |
  ProgressEvent<'blocks:get-many:blockstore:put', CID>

export type GetAllBlocksProgressEvents =
  ProgressEvent<'blocks:get-all:blockstore:get-many'>

export type DeleteBlockProgressEvents =
  ProgressEvent<'blocks:delete:blockstore:delete', CID>

export type DeleteManyBlocksProgressEvents =
  ProgressEvent<'blocks:delete-many:blockstore:delete-many'>

export interface GetOfflineOptions {
  /**
   * If true, do not attempt to fetch any missing blocks from the network
   *
   * @default false
   */
  offline?: boolean
}

export interface Blocks extends Blockstore<ProgressOptions<HasBlockProgressEvents>,
ProgressOptions<PutBlockProgressEvents>, ProgressOptions<PutManyBlocksProgressEvents>,
GetOfflineOptions & ProgressOptions<GetBlockProgressEvents>, GetOfflineOptions & ProgressOptions<GetManyBlocksProgressEvents>, ProgressOptions<GetAllBlocksProgressEvents>,
ProgressOptions<DeleteBlockProgressEvents>, ProgressOptions<DeleteManyBlocksProgressEvents>
> {

  createSession(root: CID, options?: CreateSessionOptions<GetBlockProgressEvents>): SessionBlockstore
}

/**
 * A session blockstore is a special blockstore that only pulls content from a
 * subset of network peers which respond as having the block for the initial
 * root CID.
 *
 * Any blocks written to the blockstore as part of the session will propagate
 * to the blockstore the session was created from.
 *
 */
export interface SessionBlockstore extends Blockstore<ProgressOptions<HasBlockProgressEvents>,
ProgressOptions<PutBlockProgressEvents>, ProgressOptions<PutManyBlocksProgressEvents>,
GetOfflineOptions & ProgressOptions<GetBlockProgressEvents>, GetOfflineOptions & ProgressOptions<GetManyBlocksProgressEvents>, ProgressOptions<GetAllBlocksProgressEvents>,
ProgressOptions<DeleteBlockProgressEvents>, ProgressOptions<DeleteManyBlocksProgressEvents>
> {
  /**
   * Any in-progress operations will be aborted.
   */
  close(): void
}

export interface BlockRetrievalOptions <ProgressEvents extends ProgressEvent<any, any> = ProgressEvent<any, any>> extends AbortOptions, ProgressOptions<ProgressEvents> {
  /**
   * A function that blockBrokers should call prior to returning a block to ensure it can maintain control
   * of the block request flow. e.g. TrustedGatewayBlockBroker will use this to ensure that the block
   * is valid from one of the gateways before assuming it's work is done. If the block is not valid, it should try another gateway
   * and WILL consider the gateway that returned the invalid blocks completely unreliable.
   */
  validateFn?(block: Uint8Array): Promise<void>
}

export interface BlockAnnounceOptions <ProgressEvents extends ProgressEvent<any, any> = ProgressEvent<any, any>> extends AbortOptions, ProgressOptions<ProgressEvents> {

}

export interface CreateSessionOptions <ProgressEvents extends ProgressEvent<any, any> = ProgressEvent<any, any>> extends AbortOptions, ProgressOptions<ProgressEvents> {
  /**
   * The minimum number of providers for the root CID that are required for
   * successful session creation.
   *
   * The session will become usable once this many providers have been
   * discovered, up to `maxProviders` providers will continue to be added.
   *
   * @default 1
   */
  minProviders?: number

  /**
   * The maximum number of providers for the root CID to be added to a session.
   *
   * @default 5
   */
  maxProviders?: number
}

export interface BlockBroker<RetrieveProgressEvents extends ProgressEvent<any, any> = ProgressEvent<any, any>, AnnounceProgressEvents extends ProgressEvent<any, any> = ProgressEvent<any, any>> {
  /**
   * Retrieve a block from a source
   */
  retrieve?(cid: CID, options?: BlockRetrievalOptions<RetrieveProgressEvents>): Promise<Uint8Array>

  /**
   * Make a new block available to peers
   */
  announce?(cid: CID, block: Uint8Array, options?: BlockAnnounceOptions<AnnounceProgressEvents>): Promise<void>

  /**
   * Create a new session
   */
  createSession?(options?: CreateSessionOptions<RetrieveProgressEvents>): BlockBroker<RetrieveProgressEvents, AnnounceProgressEvents>
}

export const DEFAULT_SESSION_MIN_PROVIDERS = 1
export const DEFAULT_SESSION_MAX_PROVIDERS = 5
