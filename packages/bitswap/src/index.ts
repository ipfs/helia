/**
 * @packageDocumentation
 *
 * This module implements the [Bitswap protocol](https://docs.ipfs.tech/concepts/bitswap/) in TypeScript.
 */

import { Bitswap as BitswapClass } from './bitswap.js'
import type { BitswapNetworkNotifyProgressEvents, BitswapNetworkWantProgressEvents } from './network.js'
import type { WantType } from './pb/message.js'
import type { Routing } from '@helia/interface'
import type { Libp2p, AbortOptions, Startable, ComponentLogger, Metrics, PeerId } from '@libp2p/interface'
import type { PeerSet } from '@libp2p/peer-collections'
import type { Blockstore } from 'interface-blockstore'
import type { CID } from 'multiformats/cid'
import type { MultihashHasher } from 'multiformats/hashes/interface'
import type { ProgressEvent, ProgressOptions } from 'progress-events'

export type BitswapWantProgressEvents =
  BitswapWantBlockProgressEvents

export type BitswapNotifyProgressEvents =
  BitswapNetworkNotifyProgressEvents

export type BitswapWantBlockProgressEvents =
  ProgressEvent<'bitswap:want-block:unwant', CID> |
  ProgressEvent<'bitswap:want-block:block', CID> |
  BitswapNetworkWantProgressEvents

/**
 * A bitswap session is a network overlay consisting of peers that all have the
 * first block in a file. Subsequent requests will only go to these peers.
 */
export interface BitswapSession {
  /**
   * The peers in this session
   */
  peers: PeerSet

  /**
   * Fetch an additional CID from this DAG
   */
  want(cid: CID, options?: AbortOptions & ProgressOptions<BitswapWantProgressEvents>): Promise<Uint8Array>
}

export interface WantListEntry {
  cid: CID
  session: PeerSet
  priority: number
  wantType: WantType
  cancel: boolean
  sendDontHave: boolean

  /**
   * Whether we have sent the dont-have block presence
   */
  sentDontHave?: boolean
}

export interface CreateSessionOptions extends AbortOptions, ProgressOptions<BitswapWantProgressEvents> {
  /**
   * The session will be ready after this many providers for the root CID have
   * been found. Providers will continue to be added to the session after this
   * until they reach `maxProviders`.
   *
   * @default 1
   */
  minProviders?: number

  /**
   * After this many providers for the root CID have been found, stop searching
   * for more providers.
   *
   * @default 3
   */
  maxProviders?: number

  /**
   * If true, query connected peers before searching for providers in the
   * routing.
   *
   * @default true
   */
  queryConnectedPeers?: boolean

  /**
   * The priority to use when querying availability of the root CID
   *
   * @default 1
   */
  priority?: number

  /**
   * How many peers/providers to send the initial query for the root CID to at
   * the same time
   *
   * @default 5
   */
  queryConcurrency?: number
}

export interface Bitswap extends Startable {
  /**
   * Returns the current state of the wantlist
   */
  getWantlist(): WantListEntry[]

  /**
   * Returns the current state of the wantlist for a peer, if it is being
   * tracked
   */
  getPeerWantlist(peerId: PeerId): WantListEntry[] | undefined

  /**
   * Notify bitswap that a new block is available
   */
  notify(cid: CID, block: Uint8Array, options?: ProgressOptions<BitswapNotifyProgressEvents>): Promise<void>

  /**
   * Start a session to retrieve a file from the network
   */
  want(cid: CID, options?: AbortOptions & ProgressOptions<BitswapWantProgressEvents>): Promise<Uint8Array>

  /**
   * Start a session to retrieve a file from the network
   */
  createSession(root: CID, options?: AbortOptions & ProgressOptions<BitswapWantProgressEvents>): Promise<BitswapSession>
}

export interface MultihashHasherLoader {
  getHasher(codeOrName: number | string): Promise<MultihashHasher>
}

export interface BitswapComponents {
  routing: Routing
  blockstore: Blockstore
  logger: ComponentLogger
  libp2p: Libp2p
  metrics?: Metrics
}

export interface BitswapOptions {
  /**
   * This is the maximum number of concurrent inbound bitswap streams that are
   * allowed
   *
   * @default 32
   */
  maxInboundStreams?: number

  /**
   * This is the maximum number of concurrent outbound bitswap streams that are
   * allowed
   *
   * @default 128
   */
  maxOutboundStreams?: number

  /**
   * An incoming stream must resolve within this number of seconds
   *
   * @default 30000
   */
  incomingStreamTimeout?: number

  /**
   * Whether to run on transient (e.g. time/data limited) connections
   *
   * @default false
   */
  runOnTransientConnections?: boolean

  /**
   * Enables loading esoteric hash functions
   */
  hashLoader?: MultihashHasherLoader

  /**
   * The protocol that we speak
   *
   * @default '/ipfs/bitswap/1.2.0'
   */
  protocol?: string

  /**
   * When a new peer connects, sending our WantList should complete within this
   * many ms
   *
   * @default 5000
   */
  messageSendTimeout?: number

  /**
   * When sending want list updates to peers, how many messages to send at once
   *
   * @default 50
   */
  messageSendConcurrency?: number

  /**
   * When sending blocks to peers, how many messages to send at once
   *
   * @default 50
   */
  sendBlocksConcurrency?: number

  /**
   * When sending want list updates to peers, how many messages to send at once
   *
   * @default 10000
   */
  sendBlocksTimeout?: number

  /**
   * When a block is added to the blockstore and we are about to sending that
   * block to peers who have it in their wantlist, wait this long before
   * queueing the send job in case more blocks are added that they want
   *
   * @default 10
   */
  sendBlocksDebounce?: number

  /**
   * If the client sends a want-have, and the engine has the corresponding
   * block, we check the size of the block and if it's small enough we send the
   * block itself, rather than sending a HAVE.
   *
   * This defines the maximum size up to which we replace a HAVE with a block.
   *
   * @default 1024
   */
  maxSizeReplaceHasWithBlock?: number
}

export const createBitswap = (components: BitswapComponents, options: BitswapOptions = {}): Bitswap => {
  return new BitswapClass(components, options)
}
