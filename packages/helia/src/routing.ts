import { NoRoutersAvailableError } from '@helia/interface'
import { GetFailedError } from '@helia/utils'
import { NotFoundError, setMaxListeners, start, stop } from '@libp2p/interface'
import { Queue } from '@libp2p/utils'
import { anySignal } from 'any-signal'
import merge from 'it-merge'
import { CustomProgressEvent } from 'progress-events'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import type { Routing as RoutingInterface, Provider, RoutingOptions, RoutingFindProvidersProgressEvents, RoutingProvideProgressEvents, RoutingPutProgressEvents, RoutingGetProgressEvents, RoutingFindPeerProgressEvents, RoutingGetClosestPeersProgressEvents, RoutingCancelReprovideProgressEvents, Router, Peer } from '@helia/interface'
import type { ComponentLogger, Logger, Metrics, Startable } from '@libp2p/interface'
import type { AbortOptions } from 'abort-error'
import type { CID } from 'multiformats/cid'

const DEFAULT_PROVIDER_LOOKUP_CONCURRENCY = 5

export interface RoutingInit {
  routers: Router[]
  providerLookupConcurrency?: number
}

export interface RoutingComponents {
  logger: ComponentLogger
  metrics?: Metrics
}

interface PeerQueueOptions extends AbortOptions {
  peer: CID
}

export class Routing implements RoutingInterface, Startable {
  public name: string

  private readonly log: Logger
  private readonly routers: Router[]
  private readonly providerLookupConcurrency: number

  constructor (components: RoutingComponents, init: RoutingInit) {
    this.name = 'helia'
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

  hasRouter (name: string): boolean {
    return this.routers.findIndex(r => r.name === name) !== -1
  }

  addRouter (router: Router): void {
    this.routers.push(router)
  }

  /**
   * Iterates over all content routers in parallel to find providers of the
   * given key
   */
  async * findProviders (key: CID, options: RoutingOptions<RoutingFindProvidersProgressEvents> = {}): AsyncIterable<Provider> {
    if (this.routers.length === 0) {
      throw new NoRoutersAvailableError('No content routers available')
    }

    let foundProviders = 0
    const errors: Error[] = []
    const self = this

    async function * findProviders (routers: Required<Pick<Router, 'findProviders' | 'name'>>[]): AsyncGenerator<Provider> {
      let routersFinished = 0

      const streams = routers.map(async function * (router) {
        let foundProviders = 0

        options?.onProgress?.(new CustomProgressEvent('helia:routing:find-providers:start', {
          router: router.name,
          cid: key
        }))

        try {
          for await (const prov of router.findProviders(key, options)) {
            foundProviders++

            // @ts-expect-error router.name is a string, needs to be specific
            options?.onProgress?.(new CustomProgressEvent('helia:routing:find-providers:provider', {
              router: router.name,
              cid: key,
              provider: prov
            }))

            yield prov
          }
        } catch (err: any) {
          errors.push(err)
        } finally {
          self.log('router %s found %d providers for %c', router.name, foundProviders, key)

          options?.onProgress?.(new CustomProgressEvent('helia:routing:find-providers:end', {
            router: router.name,
            cid: key,
            found: foundProviders
          }))

          routersFinished++

          // if all routers have finished and there are no jobs to find updated
          // peer multiaddres running or queued, cause the generator to exit
          if (routersFinished === routers.length && queue.size === 0) {
            queue.emitIdle()
          }
        }
      })

      // provider multiaddrs are only cached for a limited time, so they can come
      // back as an empty array - when this happens we have to do a FIND_PEER
      // query to get updated addresses, but we shouldn't block on this so use a
      // separate bounded queue to perform this lookup
      const queue = new Queue<Provider | null, PeerQueueOptions>({
        concurrency: self.providerLookupConcurrency
      })

      for await (const peer of merge(
        queue.toGenerator(),
        ...streams)
      ) {
        // the peer was yielded by a content router without multiaddrs and we
        // failed to load them
        if (peer == null) {
          continue
        }

        // have to refresh peer info for this peer to get updated multiaddrs
        if (peer.multiaddrs.length === 0) {
          // already looking this peer up
          if (queue.queue.find(job => job.options.peer.equals(peer.id)) != null) {
            continue
          }

          queue.add(async () => {
            try {
              const provider = await self.findPeer(peer.id, options)

              if (provider.multiaddrs.length === 0) {
                return null
              }

              return {
                ...provider,
                protocols: peer.protocols,
                router: peer.router
              }
            } catch (err) {
              self.log.error('could not load multiaddrs for peer %p - %e', peer.id, err)
              return null
            }
          }, {
            peer: peer.id,
            signal: options.signal
          })
            .catch(err => {
              self.log.error('could not load multiaddrs for peer %p - %e', peer.id, err)
            })

          continue
        }

        foundProviders++
        yield peer
      }
    }

    const routers = supports(this.routers, 'findProviders')
    const defaultRouters = routers.filter(r => r.capabilities == null || !r.capabilities().includes('fallback'))
    const fallbackRouters = routers.filter(r => r.capabilities?.().includes('fallback') === true)

    this.log('findProviders for %c start using routers %s', key, defaultRouters.map(r => r.name).join(', '))

    // use non-fallback routers first
    yield * findProviders(defaultRouters)

    // only use fallback routers if no providers have been found
    if (foundProviders === 0 && fallbackRouters.length > 0) {
      this.log('findProviders for %c using fallback routers %s', key, fallbackRouters.map(r => r.name).join(', '))
      yield * findProviders(fallbackRouters)
    }

    this.log('findProviders finished, found %d providers for %c', foundProviders, key)
  }

  /**
   * Iterates over all content routers in parallel to notify it is
   * a provider of the given key
   */
  async provide (key: CID, options: RoutingOptions<RoutingProvideProgressEvents> = {}): Promise<void> {
    if (this.routers.length === 0) {
      throw new NoRoutersAvailableError('No content routers available')
    }

    await Promise.all(
      supports(this.routers, 'provide')
        .map(async (router) => {
          options?.onProgress?.(new CustomProgressEvent('helia:routing:provide:start', {
            router: router.name,
            cid: key
          }))

          await router.provide(key, options)

          options?.onProgress?.(new CustomProgressEvent('helia:routing:provide:end', {
            router: router.name,
            cid: key
          }))
        })
    )
  }

  async cancelReprovide (key: CID, options: RoutingOptions<RoutingCancelReprovideProgressEvents> = {}): Promise<void> {
    await Promise.all(
      supports(this.routers, 'cancelReprovide')
        .map(async (router) => {
          options?.onProgress?.(new CustomProgressEvent('helia:routing:cancel-reprovide:start', {
            router: router.name,
            cid: key
          }))

          await router.cancelReprovide(key, options)

          options?.onProgress?.(new CustomProgressEvent('helia:routing:cancel-reprovide:end', {
            router: router.name,
            cid: key
          }))
        })
    )
  }

  /**
   * Store the given key/value pair in the available content routings
   */
  async put (key: Uint8Array, value: Uint8Array, options?: RoutingOptions<RoutingPutProgressEvents>): Promise<void> {
    await Promise.all(
      supports(this.routers, 'put')
        .map(async (router) => {
          options?.onProgress?.(new CustomProgressEvent('helia:routing:put:start', {
            router: router.name,
            key,
            value
          }))

          await router.put(key, value, options)

          options?.onProgress?.(new CustomProgressEvent('helia:routing:put:end', {
            router: router.name,
            key,
            value
          }))
        })
    )
  }

  /**
   * Get the value to the given key. The first value offered by any configured
   * router will be returned.
   */
  async get (key: Uint8Array, options?: RoutingOptions<RoutingGetProgressEvents>): Promise<Uint8Array<ArrayBuffer>> {
    const errors: Error[] = []
    let result: Uint8Array<ArrayBuffer> | undefined

    // allow aborting other requests
    const controller = new AbortController()
    const signal = anySignal([controller.signal, options?.signal])
    setMaxListeners(Infinity, signal)

    try {
      result = await Promise.any(
        supports(this.routers, 'get')
          .map(async (router) => {
            options?.onProgress?.(new CustomProgressEvent('helia:routing:get:start', {
              router: router.name,
              key
            }))

            try {
              return await router.get(key, {
                ...options,
                signal
              })
            } catch (err: any) {
              this.log('router %s failed with %e', router.name, err)
              errors.push(err)
              throw err
            } finally {
              options?.onProgress?.(new CustomProgressEvent('helia:routing:get:end', {
                router: router.name,
                key
              }))
            }
          })
      )
    } catch {
      // ignore AggregateError as we will throw a better-named one
    } finally {
      // abort any in-flight requests
      controller.abort()
      signal.clear()
    }

    if (result == null) {
      throw new GetFailedError(errors, `Failed to get value key ${uint8ArrayToString(key, 'base58btc')}`)
    }

    return result
  }

  /**
   * Iterates over all peer routers in parallel to find the given peer
   */
  async findPeer (id: CID, options?: RoutingOptions<RoutingFindPeerProgressEvents>): Promise<Peer> {
    if (this.routers.length === 0) {
      throw new NoRoutersAvailableError('No peer routers available')
    }

    // allow aborting other requests
    const controller = new AbortController()
    const signal = anySignal([controller.signal, options?.signal])
    setMaxListeners(Infinity, signal)

    const self = this
    const source = merge(
      ...supports(this.routers, 'findPeer')
        .map(router => (async function * () {
          options?.onProgress?.(new CustomProgressEvent('helia:routing:find-peer:start', {
            router: router.name,
            peerId: id
          }))

          try {
            yield await router.findPeer(id, {
              ...options,
              signal
            })
          } catch (err) {
            self.log.error(err)
          } finally {
            options?.onProgress?.(new CustomProgressEvent('helia:routing:find-peer:end', {
              router: router.name,
              peerId: id
            }))
          }
        })())
    )

    try {
      for await (const peer of source) {
        if (peer == null) {
          continue
        }

        return peer
      }
    } finally {
      // abort any in-flight requests
      controller.abort()
      signal.clear()
    }

    throw new NotFoundError('Could not find peer in routing')
  }

  /**
   * Attempt to find the closest peers on the network to the given key
   */
  async * getClosestPeers (key: Uint8Array, options: RoutingOptions<RoutingGetClosestPeersProgressEvents> = {}): AsyncIterable<Peer> {
    if (this.routers.length === 0) {
      throw new NoRoutersAvailableError('No peer routers available')
    }

    for await (const peer of merge(
      ...supports(this.routers, 'getClosestPeers')
        .map(async function * (router) {
          options?.onProgress?.(new CustomProgressEvent('helia:routing:get-closest-peers:start', {
            router: router.name,
            key
          }))

          try {
            yield * router.getClosestPeers(key, options)
          } finally {
            options?.onProgress?.(new CustomProgressEvent('helia:routing:get-closest-peers:end', {
              router: router.name,
              key
            }))
          }
        })
    )) {
      if (peer == null) {
        continue
      }

      yield peer
    }
  }
}

function supports <Operation extends keyof Router> (routers: any[], key: Operation): Array<Required<Pick<Router, Operation | 'name'>> & Pick<Router, 'capabilities'>> {
  return routers.filter(router => router[key] != null)
}
