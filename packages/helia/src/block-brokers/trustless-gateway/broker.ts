import { logger } from '@libp2p/logger'
import { TrustlessGateway } from './trustless-gateway.js'
import { DEFAULT_TRUSTLESS_GATEWAYS } from './index.js'
import type { TrustlessGatewayBlockBrokerInit, TrustlessGatewayGetBlockProgressEvents } from './index.js'
import type { BlockRetrievalOptions, BlockRetriever } from '@helia/interface/blocks'
import type { CID } from 'multiformats/cid'
import type { ProgressOptions } from 'progress-events'

const log = logger('helia:trustless-gateway-block-broker')

/**
 * A class that accepts a list of trustless gateways that are queried
 * for blocks.
 */
export class TrustlessGatewayBlockBroker implements BlockRetriever<
ProgressOptions<TrustlessGatewayGetBlockProgressEvents>
> {
  private readonly gateways: TrustlessGateway[]

  constructor (init: TrustlessGatewayBlockBrokerInit = {}) {
    this.gateways = (init.gateways ?? DEFAULT_TRUSTLESS_GATEWAYS)
      .map((gatewayOrUrl) => {
        return new TrustlessGateway(gatewayOrUrl)
      })
  }

  async retrieve (cid: CID, options: BlockRetrievalOptions<ProgressOptions<TrustlessGatewayGetBlockProgressEvents>> = {}): Promise<Uint8Array> {
    // Loop through the gateways until we get a block or run out of gateways
    // TODO: switch to toSorted when support is better
    const sortedGateways = this.gateways.sort((a, b) => b.reliability() - a.reliability())
    const aggregateErrors: Error[] = []

    for (const gateway of sortedGateways) {
      log('getting block for %c from %s', cid, gateway.url)
      try {
        const block = await gateway.getRawBlock(cid, options.signal)
        log.trace('got block for %c from %s', cid, gateway.url)
        try {
          await options.validateFn?.(block)
        } catch (err) {
          log.error('failed to validate block for %c from %s', cid, gateway.url, err)
          gateway.incrementInvalidBlocks()

          throw new Error(`unable to validate block for CID ${cid} from gateway ${gateway.url}`)
        }

        return block
      } catch (err: unknown) {
        log.error('failed to get block for %c from %s', cid, gateway.url, err)
        if (err instanceof Error) {
          aggregateErrors.push(err)
        } else {
          aggregateErrors.push(new Error(`unable to fetch raw block for CID ${cid} from gateway ${gateway.url}`))
        }
        // if signal was aborted, exit the loop
        if (options.signal?.aborted === true) {
          log.trace('request aborted while fetching raw block for CID %c from gateway %s', cid, gateway.url)
          break
        }
      }
    }

    throw new AggregateError(aggregateErrors, `unable to fetch raw block for CID ${cid} from any gateway`)
  }
}
