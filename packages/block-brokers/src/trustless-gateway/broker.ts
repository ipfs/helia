import { createTrustlessGatewaySession } from './session.js'
import { TrustlessGateway } from './trustless-gateway.js'
import { DEFAULT_TRUSTLESS_GATEWAYS } from './index.js'
import type { TrustlessGatewayBlockBrokerInit, TrustlessGatewayComponents, TrustlessGatewayGetBlockProgressEvents } from './index.js'
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
}

/**
 * A class that accepts a list of trustless gateways that are queried
 * for blocks.
 */
export class TrustlessGatewayBlockBroker implements BlockBroker<TrustlessGatewayGetBlockProgressEvents> {
  private readonly components: TrustlessGatewayComponents
  private readonly gateways: TrustlessGateway[]
  private readonly routing: Routing
  private readonly log: Logger
  private readonly logger: ComponentLogger

  constructor (components: TrustlessGatewayComponents, init: TrustlessGatewayBlockBrokerInit = {}) {
    this.components = components
    this.log = components.logger.forComponent('helia:trustless-gateway-block-broker')
    this.logger = components.logger
    this.routing = components.routing
    this.gateways = (init.gateways ?? DEFAULT_TRUSTLESS_GATEWAYS)
      .map((gatewayOrUrl) => {
        return new TrustlessGateway(gatewayOrUrl, components.logger)
      })
  }

  addGateway (gatewayOrUrl: string): void {
    this.gateways.push(new TrustlessGateway(gatewayOrUrl, this.components.logger))
  }

  async retrieve (cid: CID, options: BlockRetrievalOptions<TrustlessGatewayGetBlockProgressEvents> = {}): Promise<Uint8Array> {
    // Loop through the gateways until we get a block or run out of gateways
    // TODO: switch to toSorted when support is better
    const sortedGateways = this.gateways.sort((a, b) => b.reliability() - a.reliability())
    const aggregateErrors: Error[] = []

    for (const gateway of sortedGateways) {
      this.log('getting block for %c from %s', cid, gateway.url)
      try {
        const block = await gateway.getRawBlock(cid, options.signal)
        this.log.trace('got block for %c from %s', cid, gateway.url)
        try {
          await options.validateFn?.(block)
        } catch (err) {
          this.log.error('failed to validate block for %c from %s', cid, gateway.url, err)
          gateway.incrementInvalidBlocks()

          throw new Error(`Block for CID ${cid} from gateway ${gateway.url} failed validation`)
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
    }, options)
  }
}
