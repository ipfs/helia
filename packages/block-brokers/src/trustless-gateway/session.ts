import { AbstractSession } from '@helia/utils'
import { isPeerId } from '@libp2p/interface'
import { multiaddrToUri } from '@multiformats/multiaddr-to-uri'
import { TrustlessGateway } from './trustless-gateway.js'
import { filterNonHTTPMultiaddrs, findHttpGatewayProviders } from './utils.js'
import { DEFAULT_ALLOW_INSECURE, DEFAULT_ALLOW_LOCAL } from './index.js'
import type { CreateTrustlessGatewaySessionOptions } from './broker.js'
import type { TrustlessGatewayGetBlockProgressEvents } from './index.js'
import type { TransformRequestInit } from './trustless-gateway.js'
import type { BlockRetrievalOptions, Routing } from '@helia/interface'
import type { ComponentLogger, PeerId } from '@libp2p/interface'
import type { Multiaddr } from '@multiformats/multiaddr'
import type { AbortOptions } from 'interface-store'
import type { CID } from 'multiformats/cid'

export interface TrustlessGatewaySessionComponents {
  logger: ComponentLogger
  routing: Routing
}

class TrustlessGatewaySession extends AbstractSession<TrustlessGateway, TrustlessGatewayGetBlockProgressEvents> {
  private readonly routing: Routing
  private readonly allowInsecure: boolean
  private readonly allowLocal: boolean
  private readonly transformRequestInit?: TransformRequestInit

  constructor (components: TrustlessGatewaySessionComponents, init: CreateTrustlessGatewaySessionOptions) {
    super(components, {
      ...init,
      name: 'helia:trustless-gateway:session'
    })

    this.routing = components.routing
    this.allowInsecure = init.allowInsecure ?? DEFAULT_ALLOW_INSECURE
    this.allowLocal = init.allowLocal ?? DEFAULT_ALLOW_LOCAL
    this.transformRequestInit = init.transformRequestInit
  }

  async queryProvider (cid: CID, provider: TrustlessGateway, options: BlockRetrievalOptions): Promise<Uint8Array> {
    this.log('fetching BLOCK for %c from %s', cid, provider.url)

    const block = await provider.getRawBlock(cid, options)
    this.log.trace('got block for %c from %s', cid, provider.url)

    await options.validateFn?.(block)

    return block
  }

  async * findNewProviders (cid: CID, options: AbortOptions = {}): AsyncGenerator<TrustlessGateway> {
    yield * findHttpGatewayProviders(cid, this.routing, this.logger, this.allowInsecure, this.allowLocal, { ...options, transformRequestInit: this.transformRequestInit })
  }

  toEvictionKey (provider: TrustlessGateway): Uint8Array | string {
    return provider.url.toString()
  }

  equals (providerA: TrustlessGateway, providerB: TrustlessGateway): boolean {
    return providerA.url.toString() === providerB.url.toString()
  }

  async convertToProvider (provider: PeerId | Multiaddr | Multiaddr[], options?: AbortOptions): Promise<TrustlessGateway | undefined> {
    if (isPeerId(provider)) {
      return
    }

    const httpAddresses = filterNonHTTPMultiaddrs(Array.isArray(provider) ? provider : [provider], this.allowInsecure, this.allowLocal)

    if (httpAddresses.length === 0) {
      return
    }

    // take first address?
    // /ip4/x.x.x.x/tcp/31337/http
    // /ip4/x.x.x.x/tcp/31337/https
    // etc
    const uri = multiaddrToUri(httpAddresses[0])

    return new TrustlessGateway(uri, {
      logger: this.logger,
      transformRequestInit: this.transformRequestInit
    })
  }
}

export function createTrustlessGatewaySession (components: TrustlessGatewaySessionComponents, init: CreateTrustlessGatewaySessionOptions): TrustlessGatewaySession {
  return new TrustlessGatewaySession(components, init)
}
