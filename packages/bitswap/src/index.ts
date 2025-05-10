/**
 * @packageDocumentation
 *
 * This module implements the [Bitswap protocol](https://docs.ipfs.tech/concepts/bitswap/) in TypeScript.
 *
 * It supersedes the older [ipfs-bitswap](https://www.npmjs.com/package/ipfs-bitswap) module with the aim of being smaller, faster, better integrated with libp2p/helia, having fewer dependencies and using standard JavaScript instead of Node.js APIs.
 */

import { Bitswap as BitswapClass } from './bitswap.js'
import type { BitswapNetworkNotifyProgressEvents, BitswapNetworkWantProgressEvents, BitswapNetworkProgressEvents } from './network.js'
import type { WantType } from './pb/message.js'
import type { BlockBroker, CreateSessionOptions, ProviderOptions } from '@helia/interface'
import type { Routing } from '@helia/interface/routing'
import type { Libp2p, AbortOptions, Startable, ComponentLogger, Metrics, PeerId } from '@libp2p/interface'
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

export type { BitswapNetworkNotifyProgressEvents }
export type { BitswapNetworkWantProgressEvents }
export type { BitswapNetworkProgressEvents }
export type { WantType }

export interface WantListEntry {
  cid: CID
  priority: number
  wantType: WantType
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
  want(cid: CID, options?: AbortOptions & ProgressOptions<BitswapWantProgressEvents> & ProviderOptions): Promise<Uint8Array>

  /**
   * Start a session to retrieve a file from the network
   */
  createSession(options?: CreateSessionOptions<BitswapWantProgressEvents>): Required<Pick<BlockBroker<BitswapWantProgressEvents>, 'retrieve'>>
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
  runOnLimitedConnections?: boolean

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
   * When sending blocks to peers, timeout after this many milliseconds.
   * This is useful for preventing slow/large peer-connections from consuming
   * your bandwidth/streams.
   *
   * @default 10000
   */
  sendBlocksTimeout?: number

  /**
   * When a block is added to the blockstore and we are about to send that block
   * to peers who have it in their wantlist, wait this many milliseconds before
   * queueing the send job in case more blocks are added that they want
   *
   * @default 10
   */
  sendBlocksDebounce?: number

  /**
   * If the client sends a want-have, and we have the corresponding block, we
   * check the size of the block and if it's small enough we send the block
   * itself, rather than sending a HAVE.
   *
   * This defines the maximum size up to which we replace a HAVE with a block.
   *
   * @default 1024
   */
  maxSizeReplaceHasWithBlock?: number

  /**
   * The maximum size in bytes of a message that we will send. If a message is
   * larger than this (due to lots of blocks or wantlist entries) it will be
   * broken up into several smaller messages that are under this size.
   *
   * @see https://github.com/ipfs/boxo/blob/eeea414587350401b6b804f0574ed8436833331d/bitswap/client/internal/messagequeue/messagequeue.go#L33
   *
   * @default 2097152
   */
  maxOutgoingMessageSize?: number

  /**
   * The maximum size in bytes of an incoming message that we will process.
   *
   * Messages larger than this will cause the incoming stream to be reset.
   *
   * Defaults to `maxOutgoingMessageSize`
   *
   * @default 2097152
   */
  maxIncomingMessageSize?: number
}

export const createBitswap = (components: BitswapComponents, options: BitswapOptions = {}): Bitswap => {
  return new BitswapClass(components, options)
}
