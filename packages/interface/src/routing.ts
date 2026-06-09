import type { Multiaddr } from '@multiformats/multiaddr'
import type { AbortOptions } from 'abort-error'
import type { CID } from 'multiformats/cid'
import type { ProgressEvent, ProgressOptions } from 'progress-events'

/**
 * When a routing operation involves reading values, these options allow
 * controlling where the values are read from. Some implementations support a
 * local cache that may be used in preference over network calls, for example
 * when a record has a TTL.
 */
export interface RoutingOptions<Event extends ProgressEvent = any> extends AbortOptions, ProgressOptions<Event> {
  /**
   * Pass `false` to not use the network
   *
   * @default true
   */
  useNetwork?: boolean

  /**
   * Pass `false` to not use cached values
   *
   * @default true
   */
  useCache?: boolean

  /**
   * Pass `false` to not perform validation
   *
   * @default true
   */
  validate?: boolean

  /**
   * Where tracing is used, this value carries tracing context
   */
  trace?: any
}

/**
 * A Peer is another node on the network
 */
export interface Peer {
  /**
   * The identifier of the remote peer
   */
  id: CID<Uint8Array<ArrayBuffer>, 0x72, 0x00 | 0x12, 1>

  /**
   * The multiaddrs a peer is listening on
   */
  multiaddrs: Multiaddr[]
}

/**
 * A provider can supply the content for a CID
 */
export interface Provider {
  /**
   * The identifier of the remote peer
   */
  id: CID<Uint8Array<ArrayBuffer>, 0x72, 0x00 | 0x12, 1>

  /**
   * The multiaddrs a peer is listening on
   */
  multiaddrs: Multiaddr[]

  /**
   * If present these are the methods that the peer can supply the content via.
   *
   * If not present the caller should attempt to dial the remote peer and run
   * the identify protocol to discover how to retrieve the content.
   *
   * Example values are (but not limited to):
   *
   * - transport-graphsync-filecoinv1
   * - transport-ipfs-gateway-http
   * - transport-bitswap
   */
  protocols?: string[]

  /**
   * The name of the routing implementation that found the provider
   */
  routing: string
}

export interface RoutingFindProvidersStartEvent {
  routing: string
  cid: CID
}

export interface RoutingFindProvidersEndEvent {
  routing: string
  cid: CID
  found: number
}

export interface RoutingFindProvidersHttpGatewayProvider {
  routing: 'http-gateway-router'
  cid: CID
  provider: Peer & {
    protocols: ['transport-ipfs-gateway-http']
  }
}

export interface RoutingFindProvidersDelegatedHttpRoutingProvider {
  routing: 'delegated-http-router'
  cid: CID
  provider: Peer & {
    routing: 'delegated-http-routing'
    protocols: string[]
  }
}

export interface RoutingFindProvidersLibp2pProvider {
  routing: 'libp2p-router'
  cid: CID
  provider: Peer
}

export type RoutingFindProvidersProviderEvent = RoutingFindProvidersHttpGatewayProvider | RoutingFindProvidersDelegatedHttpRoutingProvider | RoutingFindProvidersLibp2pProvider

export type RoutingFindProvidersProgressEvents =
  ProgressEvent<'helia:routing:find-providers:start', RoutingFindProvidersStartEvent> |
  ProgressEvent<'helia:routing:find-providers:provider', RoutingFindProvidersProviderEvent> |
  ProgressEvent<'helia:routing:find-providers:end', RoutingFindProvidersEndEvent> |
  RoutingFindPeerProgressEvents

export interface RoutingProvideStartEvent {
  routing: string
  cid: CID
}

export interface RoutingProvideEndEvent {
  routing: string
  cid: CID
}

export type RoutingProvideProgressEvents =
  ProgressEvent<'helia:routing:provide:start', RoutingProvideStartEvent> |
  ProgressEvent<'helia:routing:provide:end', RoutingProvideEndEvent>

export interface RoutingCancelReprovideStartEvent {
  routing: string
  cid: CID
}

export interface RoutingCancelReprovideEndEvent {
  routing: string
  cid: CID
}

export type RoutingCancelReprovideProgressEvents =
  ProgressEvent<'helia:routing:cancel-reprovide:start', RoutingCancelReprovideStartEvent> |
  ProgressEvent<'helia:routing:cancel-reprovide:end', RoutingCancelReprovideEndEvent>

export interface RoutingPutStartEvent {
  routing: string
  key: Uint8Array
  value: Uint8Array
}

export interface RoutingPutEndEvent {
  routing: string
  key: Uint8Array
  value: Uint8Array
}

export type RoutingPutProgressEvents =
  ProgressEvent<'helia:routing:put:start', RoutingPutStartEvent> |
  ProgressEvent<'helia:routing:put:end', RoutingPutEndEvent>

export interface RoutingGetStartEvent {
  routing: string
  key: Uint8Array
}

export interface RoutingGetEndEvent {
  routing: string
  key: Uint8Array
}

export type RoutingGetProgressEvents =
  ProgressEvent<'helia:routing:get:start', RoutingGetStartEvent> |
  ProgressEvent<'helia:routing:get:end', RoutingGetEndEvent>

export interface RoutingFindPeerStartEvent {
  routing: string
  peerId: CID<Uint8Array<ArrayBuffer>, 0x72, 0x00 | 0x12, 1>
}

export interface RoutingFindPeerEndEvent {
  routing: string
  peerId: CID<Uint8Array<ArrayBuffer>, 0x72, 0x00 | 0x12, 1>
}

export type RoutingFindPeerProgressEvents =
  ProgressEvent<'helia:routing:find-peer:start', RoutingFindPeerStartEvent> |
  ProgressEvent<'helia:routing:find-peer:end', RoutingFindPeerEndEvent>

export interface RoutingGetClosestPeersStartEvent {
  routing: string
  key: Uint8Array
}

export interface RoutingGetClosestPeersEndEvent {
  routing: string
  key: Uint8Array
}

export type RoutingGetClosestPeersProgressEvents =
  ProgressEvent<'helia:routing:get-closest-peers:start', RoutingGetClosestPeersStartEvent> |
  ProgressEvent<'helia:routing:get-closest-peers:end', RoutingGetClosestPeersEndEvent>

export interface Router {
  /**
   * The name of this routing implementation
   */
  name: string

  /**
   * The implementation of this method should ensure that network peers know the
   * caller can provide content that corresponds to the passed CID.
   *
   * @example
   *
   * ```js
   * // ...
   * await contentRouting.provide(cid, {
   *   signal: AbortSignal.timeout(5_000)
   * })
   * ```
   */
  provide?(cid: CID, options?: RoutingOptions<RoutingProvideProgressEvents>): Promise<void>

  /**
   * Helia will periodically re-provide every previously provided CID. Use this
   * method to no longer re-provide the passed CID.
   *
   * @example
   *
   * ```js
   * // ...
   * await contentRouting.cancelReprovide(cid, {
   *   signal: AbortSignal.timeout(5_000)
   * })
   * ```
   */
  cancelReprovide?(key: CID, options?: AbortOptions): Promise<void>

  /**
   * Find the providers of the passed CID.
   *
   * @example
   *
   * ```js
   * // Iterate over the providers found for the given cid
   * for await (const provider of contentRouting.findProviders(cid, {
   *   signal: AbortSignal.timeout(5_000)
   * })) {
   *  console.log(provider.id, provider.multiaddrs)
   * }
   * ```
   */
  findProviders?(cid: CID, options?: RoutingOptions<RoutingFindProvidersProgressEvents>): AsyncIterable<Provider>

  /**
   * Puts a value corresponding to the passed key in a way that can later be
   * retrieved by another network peer using the get method.
   *
   * @example
   *
   * ```js
   * // ...
   * const key = uint8ArrayFromString('/key')
   * const value = uint8ArrayFromString('oh hello there')
   *
   * await contentRouting.put(key, value, {
   *   signal: AbortSignal.timeout(5_000)
   * })
   * ```
   */
  put?(key: Uint8Array, value: Uint8Array, options?: RoutingOptions<RoutingPutProgressEvents>): Promise<void>

  /**
   * Retrieves a value from the network corresponding to the passed key.
   *
   * @example
   *
   * ```js
   * // ...
   *
   * const key = uint8ArrayFromString('/key')
   * const value = await contentRouting.get(key, {
   *   signal: AbortSignal.timeout(5_000)
   * })
   * ```
   */
  get?(key: Uint8Array, options?: RoutingOptions<RoutingGetProgressEvents>): Promise<Uint8Array>

  /**
   * Searches the network for peer info corresponding to the passed peer id.
   *
   * @example
   *
   * ```js
   * // ...
   * const peer = await peerRouting.findPeer(peerId, {
   *   signal: AbortSignal.timeout(5_000)
   * })
   * ```
   */
  findPeer?(peer: CID<Uint8Array<ArrayBuffer>, 0x72, 0x00 | 0x12, 1>, options?: RoutingOptions<RoutingFindPeerProgressEvents>): Promise<Peer>

  /**
   * Search the network for peers that are closer to the passed key. Peer
   * info should be yielded in ever-increasing closeness to the key.
   *
   * @example
   *
   * ```js
   * // Iterate over the closest peers found for the given key
   * for await (const peer of peerRouting.getClosestPeers(key, {
   *   signal: AbortSignal.timeout(5_000)
   * })) {
   *   console.log(peer.id, peer.multiaddrs)
   * }
   * ```
   */
  getClosestPeers?(key: Uint8Array, options?: RoutingOptions<RoutingGetClosestPeersProgressEvents>): AsyncIterable<Peer>
}

export interface Routing extends Required<Omit<Router, 'name'>> {
  /**
   * Add a router to the routing
   */
  addRouter(router: Router): void
}
