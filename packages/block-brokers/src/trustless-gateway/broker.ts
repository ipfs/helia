import { DEFAULT_SESSION_MIN_PROVIDERS, DEFAULT_SESSION_MAX_PROVIDERS, DEFAULT_SESSION_PROVIDER_QUERY_CONCURRENCY, DEFAULT_SESSION_PROVIDER_QUERY_TIMEOUT } from '@helia/interface'
import { PeerQueue } from '@libp2p/utils/peer-queue'
import { multiaddrToUri } from '@multiformats/multiaddr-to-uri'
import pDefer from 'p-defer'
import { TrustlessGateway } from './trustless-gateway.js'
import { DEFAULT_TRUSTLESS_GATEWAYS } from './index.js'
import type { TrustlessGatewayBlockBrokerInit, TrustlessGatewayComponents, TrustlessGatewayGetBlockProgressEvents } from './index.js'
import type { Routing, BlockRetrievalOptions, BlockBroker, CreateSessionOptions } from '@helia/interface'
import type { Logger } from '@libp2p/interface'
import type { CID } from 'multiformats/cid'

export interface CreateTrustlessGatewaySessionOptions extends CreateSessionOptions<TrustlessGatewayGetBlockProgressEvents> {
  /**
   * Specify the cache control header to send to the remote. 'only-if-cached'
   * will prevent the gateway from fetching the content if they don't have it.
   *
   * @default only-if-cached
   */
  cacheControl?: string
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

  constructor (components: TrustlessGatewayComponents, init: TrustlessGatewayBlockBrokerInit = {}) {
    this.components = components
    this.log = components.logger.forComponent('helia:trustless-gateway-block-broker')
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

  async createSession (root: CID, options: CreateTrustlessGatewaySessionOptions = {}): Promise<BlockBroker<TrustlessGatewayGetBlockProgressEvents>> {
    const gateways: string[] = []
    const minProviders = options.minProviders ?? DEFAULT_SESSION_MIN_PROVIDERS
    const maxProviders = options.minProviders ?? DEFAULT_SESSION_MAX_PROVIDERS
    const deferred = pDefer<BlockBroker<TrustlessGatewayGetBlockProgressEvents>>()
    const broker = new TrustlessGatewayBlockBroker(this.components, {
      gateways
    })

    this.log('finding transport-ipfs-gateway-http providers for cid %c', root)

    const queue = new PeerQueue({
      concurrency: options.providerQueryConcurrency ?? DEFAULT_SESSION_PROVIDER_QUERY_CONCURRENCY
    })

    Promise.resolve().then(async () => {
      for await (const provider of this.routing.findProviders(root, options)) {
        if (provider.protocols == null || !provider.protocols.includes('transport-ipfs-gateway-http')) {
          continue
        }

        this.log('found transport-ipfs-gateway-http provider %p for cid %c', provider.id, root)

        void queue.add(async () => {
          for (const ma of provider.multiaddrs) {
            let uri: string | undefined

            try {
              // /ip4/x.x.x.x/tcp/31337/http
              // /ip4/x.x.x.x/tcp/31337/https
              // etc
              uri = multiaddrToUri(ma)

              const resource = `${uri}/ipfs/${root.toString()}?format=raw`

              // make sure the peer is available - HEAD support doesn't seem to
              // be very widely implemented so as long as the remote responds
              // we are happy they are valid
              // https://specs.ipfs.tech/http-gateways/trustless-gateway/#head-ipfs-cid-path-params
              const response = await fetch(resource, {
                method: 'HEAD',
                headers: {
                  Accept: 'application/vnd.ipld.raw',
                  'Cache-Control': options.cacheControl ?? 'only-if-cached'
                },
                signal: AbortSignal.timeout(options.providerQueryTimeout ?? DEFAULT_SESSION_PROVIDER_QUERY_TIMEOUT)
              })

              this.log('HEAD %s %d', resource, response.status)
              gateways.push(uri)
              broker.addGateway(uri)

              this.log('found %d transport-ipfs-gateway-http providers for cid %c', gateways.length, root)

              if (gateways.length === minProviders) {
                deferred.resolve(broker)
              }

              if (gateways.length === maxProviders) {
                queue.clear()
              }
            } catch (err: any) {
              this.log.error('could not fetch %c from %a', root, uri ?? ma, err)
            }
          }
        })
      }
    })
      .catch(err => {
        this.log.error('error creating session for %c', root, err)
      })

    return deferred.promise
  }
}
