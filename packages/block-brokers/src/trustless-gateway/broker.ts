import { createTrustlessGatewaySession } from './session.js'
import { findHttpGatewayProviders } from './utils.js'
import { DEFAULT_ALLOW_INSECURE, DEFAULT_ALLOW_LOCAL } from './index.js'
import type { TrustlessGatewayBlockBrokerInit, TrustlessGatewayBlockBrokerComponents, TrustlessGatewayGetBlockProgressEvents } from './index.js'
import type { TransformRequestInit } from './trustless-gateway.js'
import type { Routing, BlockRetrievalOptions, BlockBroker, CreateSessionOptions } from '@helia/interface'
import type { ComponentLogger, Logger } from '@libp2p/interface'
import type { CID } from 'multiformats/cid'

export interface CreateTrustlessGatewaySessionOptions extends CreateSessionOptions<TrustlessGatewayGetBlockProgressEvents> {
  /**
   * By default we will only connect to peers with HTTPS addresses, pass true
   * to also connect to HTTP addresses.
   *
   * @default false
   */
  allowInsecure?: boolean

  /**
   * By default we will only connect to peers with public or DNS addresses, pass
   * true to also connect to private addresses.
   *
   * @default false
   */
  allowLocal?: boolean
  /**
   * Provide a function that will be called before querying trustless-gateways. This lets you modify the fetch options to pass custom headers or other necessary things.
   */
  transformRequestInit?: TransformRequestInit
}

/**
 * A class that accepts a list of trustless gateways that are queried
 * for blocks.
 */
export class TrustlessGatewayBlockBroker implements BlockBroker<TrustlessGatewayGetBlockProgressEvents> {
  private readonly allowInsecure: boolean
  private readonly allowLocal: boolean
  private readonly transformRequestInit?: TransformRequestInit
  private readonly routing: Routing
  private readonly log: Logger
  private readonly logger: ComponentLogger

  constructor (components: TrustlessGatewayBlockBrokerComponents, init: TrustlessGatewayBlockBrokerInit = {}) {
    this.log = components.logger.forComponent('helia:trustless-gateway-block-broker')
    this.logger = components.logger
    this.routing = components.routing
    this.allowInsecure = init.allowInsecure ?? DEFAULT_ALLOW_INSECURE
    this.allowLocal = init.allowLocal ?? DEFAULT_ALLOW_LOCAL
    this.transformRequestInit = init.transformRequestInit
  }

  async retrieve (cid: CID, options: BlockRetrievalOptions<TrustlessGatewayGetBlockProgressEvents> = {}): Promise<Uint8Array> {
    const aggregateErrors: Error[] = []

    for await (const gateway of findHttpGatewayProviders(cid, this.routing, this.logger, this.allowInsecure, this.allowLocal, { ...options, transformRequestInit: this.transformRequestInit })) {
      this.log('getting block for %c from %s', cid, gateway.url)

      try {
        const block = await gateway.getRawBlock(cid, options)
        this.log.trace('got block for %c from %s', cid, gateway.url)

        try {
          await options.validateFn?.(block)
        } catch (err) {
          this.log.error('failed to validate block for %c from %s', cid, gateway.url, err)
          // try another gateway
          continue
        }

        return block
      } catch (err: unknown) {
        this.log.error('failed to get block for %c from %s', cid, gateway.url, err)

        if (err instanceof Error) {
          aggregateErrors.push(err)
        } else {
          aggregateErrors.push(new Error(`Unable to fetch raw block for CID ${cid} from gateway ${gateway.url}`))
        }

        // if signal was aborted, exit the loop
        if (options.signal?.aborted === true) {
          this.log.trace('request aborted while fetching raw block for CID %c from gateway %s', cid, gateway.url)
          break
        }
      }
    }

    if (aggregateErrors.length > 0) {
      throw new AggregateError(aggregateErrors, `Unable to fetch raw block for CID ${cid} from any gateway`)
    } else {
      throw new Error(`Unable to fetch raw block for CID ${cid} from any gateway`)
    }
  }

  createSession (options: CreateTrustlessGatewaySessionOptions = {}): BlockBroker<TrustlessGatewayGetBlockProgressEvents> {
    return createTrustlessGatewaySession({
      logger: this.logger,
      routing: this.routing
    }, {
      ...options,
      allowLocal: this.allowLocal,
      allowInsecure: this.allowInsecure,
      transformRequestInit: this.transformRequestInit
    })
  }
}
