import { AbstractSession } from '@helia/utils'
import { CodeError } from '@libp2p/interface'
import { isPrivateIp } from '@libp2p/utils/private-ip'
import { DNS, HTTP, HTTPS } from '@multiformats/multiaddr-matcher'
import { multiaddrToUri } from '@multiformats/multiaddr-to-uri'
import { TrustlessGateway } from './trustless-gateway.js'
import type { CreateTrustlessGatewaySessionOptions } from './broker.js'
import type { TrustlessGatewayGetBlockProgressEvents } from './index.js'
import type { BlockRetrievalOptions, Routing } from '@helia/interface'
import type { ComponentLogger } from '@libp2p/interface'
import type { Multiaddr } from '@multiformats/multiaddr'
import type { AbortOptions } from 'interface-store'
import type { CID } from 'multiformats/cid'

const DEFAULT_ALLOW_INSECURE = false
const DEFAULT_ALLOW_LOCAL = false

export interface TrustlessGatewaySessionComponents {
  logger: ComponentLogger
  routing: Routing
}

class TrustlessGatewaySession extends AbstractSession<TrustlessGateway, TrustlessGatewayGetBlockProgressEvents> {
  private readonly routing: Routing
  private readonly allowInsecure: boolean
  private readonly allowLocal: boolean

  constructor (components: TrustlessGatewaySessionComponents, init: CreateTrustlessGatewaySessionOptions) {
    super(components, {
      ...init,
      name: 'helia:trustless-gateway:session'
    })

    this.routing = components.routing
    this.allowInsecure = init.allowInsecure ?? DEFAULT_ALLOW_INSECURE
    this.allowLocal = init.allowLocal ?? DEFAULT_ALLOW_LOCAL
  }

  async queryProvider (cid: CID, provider: TrustlessGateway, options: BlockRetrievalOptions): Promise<Uint8Array> {
    this.log('fetching BLOCK for %c from %s', cid, provider.url)

    const block = await provider.getRawBlock(cid, options.signal)
    this.log.trace('got block for %c from %s', cid, provider.url)

    await options.validateFn?.(block)

    return block
  }

  async findNewProviders (cid: CID, count: number, options: AbortOptions = {}): Promise<void> {
    let found = 0

    this.log('find %d-%d new provider(s) for %c', count, this.maxProviders, cid)

    try {
      for await (const provider of this.routing.findProviders(cid, options)) {
        // require http(s) addresses
        const httpAddresses = filterMultiaddrs(provider.multiaddrs, this.allowInsecure, this.allowLocal)

        if (httpAddresses.length === 0) {
          continue
        }

        // take first address?
        // /ip4/x.x.x.x/tcp/31337/http
        // /ip4/x.x.x.x/tcp/31337/https
        // etc
        const uri = multiaddrToUri(httpAddresses[0])

        this.log('found http-gateway provider %p %s for cid %c', provider.id, uri, cid)
        const gateway = new TrustlessGateway(uri, this.logger)

        if (this.hasProvider(gateway)) {
          continue
        }

        this.providers.push(gateway)

        // let the new peer join current queries
        this.safeDispatchEvent('provider', {
          detail: provider.id
        })

        found++

        if (found === count) {
          this.log('session is ready')
          break
        }

        if (this.providers.length === this.maxProviders) {
          this.log('found max session peers', found)
          return
        }
      }
    } catch (err: any) {
      this.log.error('error searching routing for potential session peers for %c', cid, err.errors ?? err)
    }

    this.log('found %d/%d new session peers', found, count)

    if (found < count) {
      throw new CodeError(`Found ${found} of ${count} http-gateway providers for ${cid}`, 'ERR_INSUFFICIENT_PROVIDERS_FOUND')
    }
  }

  toEvictionKey (provider: TrustlessGateway): Uint8Array | string {
    return provider.url.toString()
  }

  equals (providerA: TrustlessGateway, providerB: TrustlessGateway): boolean {
    return providerA.url.toString() === providerB.url.toString()
  }
}

function filterMultiaddrs (multiaddrs: Multiaddr[], allowInsecure: boolean, allowLocal: boolean): Multiaddr[] {
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

    return false
  })
}

export function createTrustlessGatewaySession (components: TrustlessGatewaySessionComponents, init: CreateTrustlessGatewaySessionOptions): TrustlessGatewaySession {
  return new TrustlessGatewaySession(components, init)
}
