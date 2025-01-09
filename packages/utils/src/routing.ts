import { NoRoutersAvailableError } from '@helia/interface'
import { NotFoundError, start, stop } from '@libp2p/interface'
import { PeerQueue } from '@libp2p/utils/peer-queue'
import merge from 'it-merge'
import type { Routing as RoutingInterface, Provider, RoutingOptions } from '@helia/interface'
import type { AbortOptions, ComponentLogger, Logger, Metrics, PeerId, PeerInfo, Startable } from '@libp2p/interface'
import type { CID } from 'multiformats/cid'

const DEFAULT_PROVIDER_LOOKUP_CONCURRENCY = 5

export interface RoutingInit {
  routers: Array<Partial<RoutingInterface>>
  providerLookupConcurrency?: number
}

export interface RoutingComponents {
  logger: ComponentLogger
  metrics?: Metrics
}

export class Routing implements RoutingInterface, Startable {
  private readonly log: Logger
  private readonly routers: Array<Partial<RoutingInterface>>
  private readonly providerLookupConcurrency: number

  constructor (components: RoutingComponents, init: RoutingInit) {
    this.log = components.logger.forComponent('helia:routing')
    this.routers = init.routers ?? []
    this.providerLookupConcurrency = init.providerLookupConcurrency ?? DEFAULT_PROVIDER_LOOKUP_CONCURRENCY

    this.findProviders = components.metrics?.traceFunction('helia.routing.findProviders', this.findProviders.bind(this), {
      optionsIndex: 1
    }) ?? this.findProviders
    this.provide = components.metrics?.traceFunction('helia.routing.provide', this.provide.bind(this), {
      optionsIndex: 1
    }) ?? this.provide
    this.cancelReprovide = components.metrics?.traceFunction('helia.routing.cancelReprovide', this.cancelReprovide.bind(this), {
      optionsIndex: 1
    }) ?? this.cancelReprovide
    this.put = components.metrics?.traceFunction('helia.routing.put', this.put.bind(this), {
      optionsIndex: 2
    }) ?? this.put
    this.get = components.metrics?.traceFunction('helia.routing.get', this.get.bind(this), {
      optionsIndex: 1
    }) ?? this.get
    this.findPeer = components.metrics?.traceFunction('helia.routing.findPeer', this.findPeer.bind(this), {
      optionsIndex: 1
    }) ?? this.findPeer
    this.getClosestPeers = components.metrics?.traceFunction('helia.routing.getClosestPeers', this.getClosestPeers.bind(this), {
      optionsIndex: 1
    }) ?? this.getClosestPeers
  }

  async start (): Promise<void> {
    await start(...this.routers)
  }

  async stop (): Promise<void> {
    await stop(...this.routers)
  }

  /**
   * Iterates over all content routers in parallel to find providers of the
   * given key
   */
  async * findProviders (key: CID, options: RoutingOptions = {}): AsyncIterable<Provider> {
    if (this.routers.length === 0) {
      throw new NoRoutersAvailableError('No content routers available')
    }

    // provider multiaddrs are only cached for a limited time, so they can come
    // back as an empty array - when this happens we have to do a FIND_PEER
    // query to get updated addresses, but we shouldn't block on this so use a
    // separate bounded queue to perform this lookup
    const queue = new PeerQueue<Provider | null>({
      concurrency: this.providerLookupConcurrency
    })
    queue.addEventListener('error', () => {})

    for await (const peer of merge(
      queue.toGenerator(),
      ...supports(this.routers, 'findProviders')
        .map(router => router.findProviders(key, options))
    )) {
      // the peer was yielded by a content router without multiaddrs and we
      // failed to load them
      if (peer == null) {
        continue
      }

      // have to refresh peer info for this peer to get updated multiaddrs
      if (peer.multiaddrs.length === 0) {
        // already looking this peer up
        if (queue.find(peer.id) != null) {
          continue
        }

        queue.add(async () => {
          try {
            const provider = await this.findPeer(peer.id, options)

            if (provider.multiaddrs.length === 0) {
              return null
            }

            return provider
          } catch (err) {
            this.log.error('could not load multiaddrs for peer %p', peer.id, err)
            return null
          }
        }, {
          peerId: peer.id,
          signal: options.signal
        })
          .catch(err => {
            this.log.error('could not load multiaddrs for peer %p', peer.id, err)
          })
      }

      yield peer
    }
  }

  /**
   * Iterates over all content routers in parallel to notify it is
   * a provider of the given key
   */
  async provide (key: CID, options: AbortOptions = {}): Promise<void> {
    if (this.routers.length === 0) {
      throw new NoRoutersAvailableError('No content routers available')
    }

    await Promise.all(
      supports(this.routers, 'provide')
        .map(async (router) => {
          await router.provide(key, options)
        })
    )
  }

  async cancelReprovide (key: CID, options: AbortOptions = {}): Promise<void> {
    await Promise.all(
      supports(this.routers, 'cancelReprovide')
        .map(async (router) => {
          await router.cancelReprovide(key, options)
        })
    )
  }

  /**
   * Store the given key/value pair in the available content routings
   */
  async put (key: Uint8Array, value: Uint8Array, options?: AbortOptions): Promise<void> {
    await Promise.all(
      supports(this.routers, 'put')
        .map(async (router) => {
          await router.put(key, value, options)
        })
    )
  }

  /**
   * Get the value to the given key.
   * Times out after 1 minute by default.
   */
  async get (key: Uint8Array, options?: AbortOptions): Promise<Uint8Array> {
    return Promise.any(
      supports(this.routers, 'get')
        .map(async (router) => {
          return router.get(key, options)
        })
    )
  }

  /**
   * Iterates over all peer routers in parallel to find the given peer
   */
  async findPeer (id: PeerId, options?: RoutingOptions): Promise<PeerInfo> {
    if (this.routers.length === 0) {
      throw new NoRoutersAvailableError('No peer routers available')
    }

    const self = this
    const source = merge(
      ...supports(this.routers, 'findPeer')
        .map(router => (async function * () {
          try {
            yield await router.findPeer(id, options)
          } catch (err) {
            self.log.error(err)
          }
        })())
    )

    for await (const peer of source) {
      if (peer == null) {
        continue
      }

      return peer
    }

    throw new NotFoundError('Could not find peer in routing')
  }

  /**
   * Attempt to find the closest peers on the network to the given key
   */
  async * getClosestPeers (key: Uint8Array, options: RoutingOptions = {}): AsyncIterable<PeerInfo> {
    if (this.routers.length === 0) {
      throw new NoRoutersAvailableError('No peer routers available')
    }

    for await (const peer of merge(
      ...supports(this.routers, 'getClosestPeers')
        .map(router => router.getClosestPeers(key, options))
    )) {
      if (peer == null) {
        continue
      }

      yield peer
    }
  }
}

function supports <Operation extends keyof Routing> (routers: any[], key: Operation): Array<Pick<Routing, Operation>> {
  return routers.filter(router => router[key] != null)
}
