import { peerIdFromCID } from '@libp2p/peer-id'
import { uriToMultiaddr } from '@multiformats/uri-to-multiaddr'
import { CID } from 'multiformats/cid'
import { identity } from 'multiformats/hashes/identity'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import type { Provider, Routing, RoutingOptions } from '@helia/interface'
import type { PeerInfo } from '@libp2p/interface'
import type { Version } from 'multiformats'

interface GatewayStatus {
  peerInfo: PeerInfo
  corsSupported: boolean | null
  lastChecked: number
}

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
  /**
   * How long to cache CORS probe results in milliseconds
   *
   * @default 300000 (5 minutes)
   */
  corsCheckCacheMs?: number
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
  private readonly gatewayStatuses: GatewayStatus[]
  private readonly shuffle: boolean
  private readonly corsCheckCacheMs: number

  constructor (init: HTTPGatewayRouterInit = {}) {
    this.gatewayStatuses = (init.gateways ?? DEFAULT_TRUSTLESS_GATEWAYS).map(url => ({
      peerInfo: toPeerInfo(url),
      corsSupported: null,
      lastChecked: 0
    }))
    this.shuffle = init.shuffle ?? true
    this.corsCheckCacheMs = init.corsCheckCacheMs ?? 300000
  }

  private async checkCorsSupport (gatewayUrl: string): Promise<boolean> {
    try {
      const response = await fetch(`${gatewayUrl}/ipfs/bafkqaaa`, {
        method: 'GET',
        mode: 'cors'
      })

      const corsHeaders = response.headers.get('access-control-allow-origin')
      const hasCors = corsHeaders === '*' || corsHeaders?.includes(window.location.origin)

      return hasCors && (response.ok || response.status === 404)
    } catch (error) {
      return false
    }
  }

  private async ensureCorsStatus (gateway: GatewayStatus): Promise<boolean> {
    const now = Date.now()
    if (gateway.corsSupported !== null && (now - gateway.lastChecked) < this.corsCheckCacheMs) {
      return gateway.corsSupported
    }

    const gatewayUrl = gateway.peerInfo.multiaddrs[0]?.toString().replace('/http', 'http').replace('/https', 'https')
    if (!gatewayUrl) {
      return false
    }

    gateway.corsSupported = await this.checkCorsSupport(gatewayUrl)
    gateway.lastChecked = now
    return gateway.corsSupported
  }

  async * findProviders (cid: CID<unknown, number, number, Version>, options?: RoutingOptions | undefined): AsyncIterable<Provider> {
    const gatewaysToCheck = this.shuffle
      ? this.gatewayStatuses.toSorted(() => Math.random() > 0.5 ? 1 : -1)
      : this.gatewayStatuses

    for (const gateway of gatewaysToCheck) {
      if (await this.ensureCorsStatus(gateway)) {
        yield {
          ...gateway.peerInfo,
          protocols: ['transport-ipfs-gateway-http']
        }
      }
    }
  }
}

/**
 * Returns a static list of HTTP Gateways as providers
 */
export function httpGatewayRouting (init: HTTPGatewayRouterInit = {}): Partial<Routing> {
  return new HTTPGatewayRouter(init)
}
