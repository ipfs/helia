import { CodeError, start, stop } from '@libp2p/interface'
import { PeerSet } from '@libp2p/peer-collections'
import merge from 'it-merge'
import type { Routing as RoutingInterface, Provider, RoutingOptions } from '@helia/interface'
import type { AbortOptions, ComponentLogger, Logger, PeerId, PeerInfo, Startable } from '@libp2p/interface'
import type { CID } from 'multiformats/cid'

export interface RoutingInit {
  routers: Array<Partial<RoutingInterface>>
}

export interface RoutingComponents {
  logger: ComponentLogger
}

export class Routing implements RoutingInterface, Startable {
  private readonly log: Logger
  private readonly routers: Array<Partial<RoutingInterface>>

  constructor (components: RoutingComponents, init: RoutingInit) {
    this.log = components.logger.forComponent('helia:routing')
    this.routers = init.routers ?? []
  }

  async start (): Promise<void> {
    await start(...this.routers)
  }

  async stop (): Promise<void> {
    await stop(...this.routers)
  }

  /**
   * Iterates over all content routers in parallel to find providers of the given key
   */
  async * findProviders (key: CID, options: RoutingOptions = {}): AsyncIterable<Provider> {
    if (this.routers.length === 0) {
      throw new CodeError('No content routers available', 'ERR_NO_ROUTERS_AVAILABLE')
    }

    const seen = new PeerSet()

    for await (const peer of merge(
      ...supports(this.routers, 'findProviders')
        .map(router => router.findProviders(key, options))
    )) {
      // the peer was yielded by a content router without multiaddrs and we
      // failed to load them
      if (peer == null) {
        continue
      }

      // deduplicate peers
      if (seen.has(peer.id)) {
        continue
      }

      seen.add(peer.id)

      yield peer
    }
  }

  /**
   * Iterates over all content routers in parallel to notify it is
   * a provider of the given key
   */
  async provide (key: CID, options: AbortOptions = {}): Promise<void> {
    if (this.routers.length === 0) {
      throw new CodeError('No content routers available', 'ERR_NO_ROUTERS_AVAILABLE')
    }

    await Promise.all(
      supports(this.routers, 'provide')
        .map(async (router) => {
          await router.provide(key, options)
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
      throw new CodeError('No peer routers available', 'ERR_NO_ROUTERS_AVAILABLE')
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

    throw new CodeError('Could not find peer in routing', 'ERR_NOT_FOUND')
  }

  /**
   * Attempt to find the closest peers on the network to the given key
   */
  async * getClosestPeers (key: Uint8Array, options: RoutingOptions = {}): AsyncIterable<PeerInfo> {
    if (this.routers.length === 0) {
      throw new CodeError('No peer routers available', 'ERR_NO_ROUTERS_AVAILABLE')
    }

    const seen = new PeerSet()

    for await (const peer of merge(
      ...supports(this.routers, 'getClosestPeers')
        .map(router => router.getClosestPeers(key, options))
    )) {
      if (peer == null) {
        continue
      }

      // deduplicate peers
      if (seen.has(peer.id)) {
        continue
      }

      seen.add(peer.id)

      yield peer
    }
  }
}

function supports <Operation extends keyof Routing> (routers: any[], key: Operation): Array<Pick<Routing, Operation>> {
  return routers.filter(router => router[key] != null)
}
