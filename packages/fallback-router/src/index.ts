/**
 * @packageDocumentation
 *
 * A fallback router yields preconfigured providers to enable Helia to fallback
 * to using a trustless gateway to fetch content from peers that support
 * transports that may not be available in Helia's environment
 *
 * For example this allows browser peers to fetch content from network nodes
 * that only support TCP or QUIC connections.
 */

import { uriToMultiaddr } from '@multiformats/uri-to-multiaddr'
import { CID } from 'multiformats/cid'
import { identity } from 'multiformats/hashes/identity'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import type { Peer, Provider, Router, RoutingOptions } from '@helia/interface'
import type { Version } from 'multiformats'

export interface FallbackRouterInit {
  /**
   * Where to send requests
   */
  gateways: Array<URL | string>

  /**
   * Whether to shuffle the list of gateways
   *
   * @default true
   */
  shuffle?: boolean
}

// this value is from https://github.com/multiformats/multicodec/blob/master/table.csv
const TRANSPORT_IPFS_GATEWAY_HTTP_CODE = 0x0920

function toPeerInfo (url: string | URL): Peer {
  url = url.toString()

  return {
    id: CID.createV1(TRANSPORT_IPFS_GATEWAY_HTTP_CODE, identity.digest(uint8ArrayFromString(url))),
    multiaddrs: [
      uriToMultiaddr(url)
    ],
    routing: 'fallback-router'
  }
}

function toUrl (info: Peer): URL {
  return new URL(uint8ArrayToString(info.id.multihash.digest))
}

class FallbackRouter implements Router {
  public readonly name = 'fallback-router'
  private readonly gateways: Peer[]
  private readonly shuffle: boolean

  constructor (init: FallbackRouterInit) {
    this.gateways = init.gateways.map(url => toPeerInfo(url)) ?? []
    this.shuffle = init.shuffle ?? true
  }

  async * findProviders (cid: CID<unknown, number, number, Version>, options?: RoutingOptions | undefined): AsyncIterable<Provider> {
    yield * (this.shuffle
      ? this.gateways.toSorted(() => Math.random() > 0.5 ? 1 : -1)
      : this.gateways
    ).map(info => {
      const provider = {
        ...info,
        id: info.id,
        protocols: ['transport-ipfs-gateway-http'],
        routing: 'fallback-router'
      }

      return provider
    })
  }

  toString (): string {
    return `FallbackRouter([${this.gateways.map(info => toUrl(info)).join(', ')}])`
  }
}

/**
 * Returns a static list of HTTP Gateways as providers
 */
export function fallbackRouter (init: FallbackRouterInit): Router {
  return new FallbackRouter(init)
}
