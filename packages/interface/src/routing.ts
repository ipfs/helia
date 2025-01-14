import type { AbortOptions, PeerId, PeerInfo, TraceOptions } from '@libp2p/interface'
import type { CID } from 'multiformats/cid'
import type { ProgressOptions } from 'progress-events'

/**
 * When a routing operation involves reading values, these options allow
 * controlling where the values are read from. Some implementations support a
 * local cache that may be used in preference over network calls, for example
 * when a record has a TTL.
 */
export interface RoutingOptions extends AbortOptions, ProgressOptions, TraceOptions {
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
}

/**
 * A provider can supply the content for a CID
 */
export interface Provider extends PeerInfo {
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
}

export interface Routing {
  /**
   * The implementation of this method should ensure that network peers know the
   * caller can provide content that corresponds to the passed CID.
   *
   * @example
   *
   * ```js
   * // ...
   * await contentRouting.provide(cid)
   * ```
   */
  provide(cid: CID, options?: RoutingOptions): Promise<void>

  /**
   * Helia will periodically re-provide every previously provided CID. Use this
   * method to no longer re-provide the passed CID.
   *
   * @example
   *
   * ```js
   * // ...
   * await contentRouting.cancelReprovide(cid)
   * ```
   */
  cancelReprovide(key: CID, options?: AbortOptions): Promise<void>

  /**
   * Find the providers of the passed CID.
   *
   * @example
   *
   * ```js
   * // Iterate over the providers found for the given cid
   * for await (const provider of contentRouting.findProviders(cid)) {
   *  console.log(provider.id, provider.multiaddrs)
   * }
   * ```
   */
  findProviders(cid: CID, options?: RoutingOptions): AsyncIterable<Provider>

  /**
   * Puts a value corresponding to the passed key in a way that can later be
   * retrieved by another network peer using the get method.
   *
   * @example
   *
   * ```js
   * // ...
   * const key = '/key'
   * const value = uint8ArrayFromString('oh hello there')
   *
   * await contentRouting.put(key, value)
   * ```
   */
  put(key: Uint8Array, value: Uint8Array, options?: RoutingOptions): Promise<void>

  /**
   * Retrieves a value from the network corresponding to the passed key.
   *
   * @example
   *
   * ```js
   * // ...
   *
   * const key = '/key'
   * const value = await contentRouting.get(key)
   * ```
   */
  get(key: Uint8Array, options?: RoutingOptions): Promise<Uint8Array>

  /**
   * Searches the network for peer info corresponding to the passed peer id.
   *
   * @example
   *
   * ```js
   * // ...
   * const peer = await peerRouting.findPeer(peerId, options)
   * ```
   */
  findPeer(peerId: PeerId, options?: RoutingOptions): Promise<PeerInfo>

  /**
   * Search the network for peers that are closer to the passed key. Peer
   * info should be yielded in ever-increasing closeness to the key.
   *
   * @example
   *
   * ```js
   * // Iterate over the closest peers found for the given key
   * for await (const peer of peerRouting.getClosestPeers(key)) {
   *   console.log(peer.id, peer.multiaddrs)
   * }
   * ```
   */
  getClosestPeers(key: Uint8Array, options?: RoutingOptions): AsyncIterable<PeerInfo>
}
