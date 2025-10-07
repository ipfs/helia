import { peerIdFromCID } from '@libp2p/peer-id'
import { uriToMultiaddr } from '@multiformats/uri-to-multiaddr'
import { CID } from 'multiformats/cid'
import { identity } from 'multiformats/hashes/identity'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import type { Provider, Routing, RoutingOptions } from '@helia/interface'
import type { PeerInfo } from '@libp2p/interface'
import type { Version } from 'multiformats'

export const DEFAULT_TRUSTLESS_GATEWAYS = [
  // 2023-10-03: IPNS, Origin, and Block/CAR support from https://ipfs.github.io/public-gateway-checker/
  'https://trustless-gateway.link',

  // 2023-10-03: IPNS, Origin, and Block/CAR support from https://ipfs.github.io/public-gateway-checker/
  'https://4everland.io'
]

export interface HTTPGatewayRouterInit {
  gateways?: Array<URL | string>
  /**
   * Whether to shuffle the list of gateways
   *
   * @default true
   */
  shuffle?: boolean
}

// this value is from https://github.com/multiformats/multicodec/blob/master/table.csv
const TRANSPORT_IPFS_GATEWAY_HTTP_CODE = 0x0920

function toPeerInfo (url: string | URL): PeerInfo {
  url = url.toString()

  return {
    id: peerIdFromCID(CID.createV1(TRANSPORT_IPFS_GATEWAY_HTTP_CODE, identity.digest(uint8ArrayFromString(url)))),
    multiaddrs: [
      uriToMultiaddr(url)
    ]
  }
}

class HTTPGatewayRouter implements Partial<Routing> {
  private readonly gateways: PeerInfo[]
  private readonly shuffle: boolean

  constructor (init: HTTPGatewayRouterInit = {}) {
    this.gateways = (init.gateways ?? DEFAULT_TRUSTLESS_GATEWAYS).map(url => toPeerInfo(url))
    this.shuffle = init.shuffle ?? true
  }

  async * findProviders (cid: CID<unknown, number, number, Version>, options?: RoutingOptions | undefined): AsyncIterable<Provider> {
    yield * (this.shuffle
      ? this.gateways.toSorted(() => Math.random() > 0.5 ? 1 : -1)
      : this.gateways
    ).map(info => ({
      ...info,
      protocols: ['transport-ipfs-gateway-http']
    }))
  }
}

/**
 * Returns a static list of HTTP Gateways as providers
 */
export function httpGatewayRouting (init: HTTPGatewayRouterInit = {}): Partial<Routing> {
  return new HTTPGatewayRouter(init)
}
