import { isPrivateIp } from '@libp2p/utils/private-ip'
import { DNS, HTTP, HTTPS } from '@multiformats/multiaddr-matcher'
import { multiaddrToUri } from '@multiformats/multiaddr-to-uri'
import { TrustlessGateway } from './trustless-gateway.js'
import type { TransformRequestInit } from './trustless-gateway.js'
import type { Routing } from '@helia/interface'
import type { ComponentLogger } from '@libp2p/interface'
import type { AbortOptions, Multiaddr } from '@multiformats/multiaddr'
import type { CID } from 'multiformats/cid'

export function filterNonHTTPMultiaddrs (multiaddrs: Multiaddr[], allowInsecure: boolean, allowLocal: boolean): Multiaddr[] {
  return multiaddrs.filter(ma => {
    if (HTTPS.matches(ma) || (allowInsecure && HTTP.matches(ma))) {
      if (allowLocal) {
        return true
      }

      if (DNS.matches(ma)) {
        return true
      }

      return isPrivateIp(ma.toOptions().host) === false
    }

    // When allowInsecure is false and allowLocal is true, allow multiaddrs with "127.0.0.1", "localhost", or any subdomain ending with ".localhost"
    if (!allowInsecure && allowLocal) {
      const { host } = ma.toOptions()
      if (host === '127.0.0.1' || host === 'localhost' || host.endsWith('.localhost')) {
        return true
      }
    }

    return false
  })
}

export interface FindHttpGatewayProvidersOptions extends AbortOptions {
  transformRequestInit?: TransformRequestInit
}

export async function * findHttpGatewayProviders (cid: CID, routing: Routing, logger: ComponentLogger, allowInsecure: boolean, allowLocal: boolean, options: FindHttpGatewayProvidersOptions = {}): AsyncGenerator<TrustlessGateway> {
  for await (const provider of routing.findProviders(cid, options)) {
    // require http(s) addresses
    const httpAddresses = filterNonHTTPMultiaddrs(provider.multiaddrs, allowInsecure, allowLocal)

    if (httpAddresses.length === 0) {
      continue
    }

    // take first address?
    // /ip4/x.x.x.x/tcp/31337/http
    // /ip4/x.x.x.x/tcp/31337/https
    // etc
    const uri = multiaddrToUri(httpAddresses[0])

    yield new TrustlessGateway(uri, { logger, transformRequestInit: options.transformRequestInit })
  }
}
