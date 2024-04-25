import { peerIdSymbol } from '@libp2p/interface'
import { uriToMultiaddr } from '@multiformats/uri-to-multiaddr'
import { CID } from 'multiformats/cid'
import { identity } from 'multiformats/hashes/identity'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import type { Provider, Routing, RoutingOptions } from '@helia/interface'
import type { PeerId, PeerInfo } from '@libp2p/interface'
import type { MultihashDigest, Version } from 'multiformats'

export const DEFAULT_TRUSTLESS_GATEWAYS = [
  // 2023-10-03: IPNS, Origin, and Block/CAR support from https://ipfs-public-gateway-checker.on.fleek.co/
  'https://trustless-gateway.link',

  // 2023-10-03: IPNS, Origin, and Block/CAR support from https://ipfs-public-gateway-checker.on.fleek.co/
  'https://4everland.io'
]

export interface HTTPGatwayRouterInit {
  gateways?: Array<URL | string>
}

// these values are from https://github.com/multiformats/multicodec/blob/master/table.csv
const TRANSPORT_IPFS_GATEWAY_HTTP_CODE = 0x0920
const inspect = Symbol.for('nodejs.util.inspect.custom')

class URLPeerId implements PeerId {
  readonly type = 'url'
  readonly multihash: MultihashDigest
  readonly privateKey?: Uint8Array
  readonly publicKey?: Uint8Array
  readonly url: string

  constructor (url: URL) {
    this.url = url.toString()
    this.multihash = identity.digest(uint8ArrayFromString(this.url))
  }

  [inspect] (): string {
    return `PeerId(${this.url})`
  }

  readonly [peerIdSymbol] = true

  toString (): string {
    return this.toCID().toString()
  }

  toCID (): CID {
    return CID.createV1(TRANSPORT_IPFS_GATEWAY_HTTP_CODE, this.multihash)
  }

  toBytes (): Uint8Array {
    return this.toCID().bytes
  }

  equals (other?: PeerId | Uint8Array | string): boolean {
    if (other == null) {
      return false
    }

    if (other instanceof Uint8Array) {
      other = uint8ArrayToString(other)
    }

    return other.toString() === this.toString()
  }
}

function toPeerInfo (url: string | URL): PeerInfo {
  url = url.toString()

  return {
    id: new URLPeerId(new URL(url)),
    multiaddrs: [
      uriToMultiaddr(url)
    ]
  }
}

class HTTPGatwayRouter implements Partial<Routing> {
  private readonly gateways: PeerInfo[]

  constructor (init: HTTPGatwayRouterInit = {}) {
    this.gateways = (init.gateways ?? DEFAULT_TRUSTLESS_GATEWAYS).map(url => toPeerInfo(url))
  }

  async * findProviders (cid: CID<unknown, number, number, Version>, options?: RoutingOptions | undefined): AsyncIterable<Provider> {
    yield * this.gateways.toSorted(() => Math.random() > 0.5 ? 1 : -1).map(info => ({
      ...info,
      protocols: ['transport-ipfs-gateway-http']
    }))
  }
}

/**
 * Returns a static list of HTTP Gateways as providers
 */
export function httpGatewayRouting (init: HTTPGatwayRouterInit = {}): Partial<Routing> {
  return new HTTPGatwayRouter(init)
}
