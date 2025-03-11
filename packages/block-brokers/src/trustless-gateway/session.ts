import { AbstractSession } from '@helia/utils'
import { findHttpGatewayProviders } from './utils.js'
import { DEFAULT_ALLOW_INSECURE, DEFAULT_ALLOW_LOCAL } from './index.js'
import type { CreateTrustlessGatewaySessionOptions } from './broker.js'
import type { TrustlessGatewayGetBlockProgressEvents } from './index.js'
import type { TransformRequestInit, TrustlessGateway } from './trustless-gateway.js'
import type { BlockRetrievalOptions, Routing } from '@helia/interface'
import type { ComponentLogger } from '@libp2p/interface'
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

    const block = await provider.getRawBlock(cid, options.signal)
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
}

export function createTrustlessGatewaySession (components: TrustlessGatewaySessionComponents, init: CreateTrustlessGatewaySessionOptions): TrustlessGatewaySession {
  return new TrustlessGatewaySession(components, init)
}
