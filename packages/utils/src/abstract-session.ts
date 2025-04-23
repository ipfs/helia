import { DEFAULT_SESSION_MIN_PROVIDERS, DEFAULT_SESSION_MAX_PROVIDERS, InsufficientProvidersError } from '@helia/interface'
import { AbortError, TypedEventEmitter, setMaxListeners } from '@libp2p/interface'
import { createScalableCuckooFilter } from '@libp2p/utils/filters'
import { Queue } from '@libp2p/utils/queue'
import { base64 } from 'multiformats/bases/base64'
import pDefer from 'p-defer'
import type { BlockBroker, BlockRetrievalOptions, CreateSessionOptions } from '@helia/interface'
import type { AbortOptions, ComponentLogger, Logger, PeerId } from '@libp2p/interface'
import type { Filter } from '@libp2p/utils/filters'
import type { Multiaddr } from '@multiformats/multiaddr'
import type { CID } from 'multiformats/cid'
import type { DeferredPromise } from 'p-defer'
import type { ProgressEvent } from 'progress-events'

export interface AbstractSessionComponents {
  logger: ComponentLogger
}

export interface AbstractCreateSessionOptions extends CreateSessionOptions {
  name: string
}

export interface BlockstoreSessionEvents<Provider> {
  provider: CustomEvent<Provider>
}

export abstract class AbstractSession<Provider, RetrieveBlockProgressEvents extends ProgressEvent> extends TypedEventEmitter<BlockstoreSessionEvents<Provider>> implements BlockBroker<RetrieveBlockProgressEvents> {
  private initialPeerSearchComplete?: Promise<void>
  private readonly requests: Map<string, Promise<Uint8Array>>
  private readonly name: string
  protected log: Logger
  protected logger: ComponentLogger
  private readonly minProviders: number
  private readonly maxProviders: number
  public readonly providers: Provider[]
  private readonly evictionFilter: Filter
  private readonly initialProviders: Array<PeerId | Multiaddr | Multiaddr[]>

  constructor (components: AbstractSessionComponents, init: AbstractCreateSessionOptions) {
    super()

    setMaxListeners(Infinity, this)
    this.name = init.name
    this.logger = components.logger
    this.log = components.logger.forComponent(this.name)
    this.requests = new Map()
    this.minProviders = init.minProviders ?? DEFAULT_SESSION_MIN_PROVIDERS
    this.maxProviders = init.maxProviders ?? DEFAULT_SESSION_MAX_PROVIDERS
    this.providers = []
    this.evictionFilter = createScalableCuckooFilter(this.maxProviders)
    this.initialProviders = init.providers ?? []
  }

  async retrieve (cid: CID, options: BlockRetrievalOptions<RetrieveBlockProgressEvents> = {}): Promise<Uint8Array> {
    // see if we are already requesting this CID in this session
    const cidStr = base64.encode(cid.multihash.bytes)
    const existingJob = this.requests.get(cidStr)

    if (existingJob != null) {
      this.log('join existing request for %c', cid)
      return existingJob
    }

    const deferred: DeferredPromise<Uint8Array> = pDefer()
    this.requests.set(cidStr, deferred.promise)

    if (this.providers.length === 0) {
      let first = false

      if (this.initialPeerSearchComplete == null) {
        first = true
        this.log = this.logger.forComponent(`${this.name}:${cid}`)
        this.initialPeerSearchComplete = this.findProviders(cid, this.minProviders, options)
      }

      await this.initialPeerSearchComplete

      if (first) {
        this.log('found initial session peers for %c', cid)
      }
    }

    let foundBlock = false

    // this queue manages outgoing requests - as new peers are added to the
    // session they will be added to the queue so we can request the current
    // block from multiple peers as they are discovered
    const queue = new Queue<Uint8Array, { provider: Provider, priority?: number } & AbortOptions>({
      concurrency: this.maxProviders
    })
    queue.addEventListener('error', () => {})
    queue.addEventListener('failure', (evt) => {
      this.log.error('error querying provider %o, evicting from session', evt.detail.job.options.provider, evt.detail.error)
      this.evict(evt.detail.job.options.provider)
    })
    queue.addEventListener('success', (evt) => {
      // peer has sent block, return it to the caller
      foundBlock = true
      deferred.resolve(evt.detail.result)
    })
    queue.addEventListener('idle', () => {
      if (foundBlock || options.signal?.aborted === true) {
        this.log.trace('session idle, found block')
        // we either found the block or the user gave up
        return
      }

      // find more session peers and retry
      Promise.resolve()
        .then(async () => {
          this.log('no session peers had block for for %c, finding new providers', cid)

          // evict this.minProviders random providers to make room for more
          for (let i = 0; i < this.minProviders; i++) {
            if (this.providers.length === 0) {
              break
            }

            const provider = this.providers[Math.floor(Math.random() * this.providers.length)]
            this.evict(provider)
          }

          // find new providers for the CID
          await this.findProviders(cid, this.minProviders, options)

          // keep trying until the abort signal fires
          this.log('found new providers re-retrieving %c', cid)
          this.requests.delete(cidStr)
          deferred.resolve(await this.retrieve(cid, options))
        })
        .catch(err => {
          this.log.error('could not find new providers for %c', cid, err)
          deferred.reject(err)
        })
    })

    const peerAddedToSessionListener = (event: CustomEvent<Provider>): void => {
      queue.add(async () => {
        return this.queryProvider(cid, event.detail, options)
      }, {
        provider: event.detail
      })
        .catch(err => {
          if (options.signal?.aborted === true) {
            // skip logging error if signal was aborted because abort can happen
            // on success (e.g. another session found the block)
            return
          }

          this.log.error('error retrieving session block for %c', cid, err)
        })
    }

    // add new session peers to query as they are discovered
    this.addEventListener('provider', peerAddedToSessionListener)

    // query each session peer directly
    Promise.all([...this.providers].map(async (provider) => {
      return queue.add(async () => {
        return this.queryProvider(cid, provider, options)
      }, {
        provider
      })
    }))
      .catch(err => {
        if (options.signal?.aborted === true) {
          // skip logging error if signal was aborted because abort can happen
          // on success (e.g. another session found the block)
          return
        }

        this.log.error('error retrieving session block for %c', cid, err)
      })

    const signalAbortedListener = (): void => {
      deferred.reject(new AbortError(options.signal?.reason ?? 'Session aborted'))
      queue.abort()
    }

    options.signal?.addEventListener('abort', signalAbortedListener)

    try {
      return await deferred.promise
    } finally {
      this.removeEventListener('provider', peerAddedToSessionListener)
      options.signal?.removeEventListener('abort', signalAbortedListener)
      queue.clear()
      this.requests.delete(cidStr)
    }
  }

  evict (provider: Provider): void {
    this.evictionFilter.add(this.toEvictionKey(provider))
    const index = this.providers.findIndex(prov => this.equals(prov, provider))

    if (index === -1) {
      return
    }

    this.providers.splice(index, 1)
  }

  isEvicted (provider: Provider): boolean {
    return this.evictionFilter.has(this.toEvictionKey(provider))
  }

  hasProvider (provider: Provider): boolean {
    // dedupe existing gateways
    if (this.providers.find(prov => this.equals(prov, provider)) != null) {
      return true
    }

    // dedupe failed session peers
    if (this.isEvicted(provider)) {
      return true
    }

    return false
  }

  private async findProviders (cid: CID, count: number, options: AbortOptions): Promise<void> {
    const deferred: DeferredPromise<void> = pDefer()
    let found = 0

    // run async to resolve the deferred promise when `count` providers are
    // found but continue util this.providers reaches this.maxProviders
    void Promise.resolve()
      .then(async () => {
        this.log('finding %d-%d new provider(s) for %c', count, this.maxProviders, cid)

        // process any specific providers for this session
        if (this.initialProviders.length > 0) {
          while (found < count && this.initialProviders.length > 0) {
            const prov = this.initialProviders.pop()

            if (prov == null) {
              break
            }

            const provider = await this.convertToProvider(prov, options)

            if (options.signal?.aborted === true) {
              break
            }

            if (provider == null) {
              continue
            }

            if (this.hasProvider(provider)) {
              continue
            }

            this.log('found %d/%d new providers', found, this.maxProviders)
            this.providers.push(provider)

            // let the new peer join current queries
            this.safeDispatchEvent('provider', {
              detail: provider
            })

            found++

            if (found === count) {
              this.log('session is ready')
              deferred.resolve()
              // continue finding peers until we reach this.maxProviders
            }

            if (this.providers.length === this.maxProviders) {
              this.log('found max session peers', found)
              break
            }
          }
        }

        // still not got enough providers, search routing for more
        if (found < this.maxProviders) {
          for await (const provider of this.findNewProviders(cid, options)) {
            if (found === this.maxProviders || options.signal?.aborted === true) {
              break
            }

            if (this.hasProvider(provider)) {
              continue
            }

            this.log('found %d/%d new providers', found, this.maxProviders)
            this.providers.push(provider)

            // let the new peer join current queries
            this.safeDispatchEvent('provider', {
              detail: provider
            })

            found++

            if (found === count) {
              this.log('session is ready')
              deferred.resolve()
              // continue finding peers until we reach this.maxProviders
            }

            if (this.providers.length === this.maxProviders) {
              this.log('found max session peers', found)
              break
            }
          }
        }

        this.log('found %d/%d new session peers', found, this.maxProviders)

        if (found < count) {
          throw new InsufficientProvidersError(`Found ${found} of ${count} ${this.name} providers for ${cid}`)
        }
      })
      .catch(err => {
        this.log.error('error searching routing for potential session peers for %c', cid, err.errors ?? err)
        deferred.reject(err)
      })

    return deferred.promise
  }

  /**
   * If this session was created with specific providers, convert one of them
   * into the format required or return `undefined` if the provider is not
   * compatible with this session implementation
   */
  abstract convertToProvider (provider: PeerId | Multiaddr | Multiaddr[], options?: AbortOptions): Promise<Provider | undefined>

  /**
   * This method should search for new providers and yield them.
   */
  abstract findNewProviders (cid: CID, options: AbortOptions): AsyncGenerator<Provider>

  /**
   * The subclass should contact the provider and request the block from it.
   *
   * If the provider cannot provide the block an error should be thrown.
   *
   * The provider will then be excluded from ongoing queries.
   */
  abstract queryProvider (cid: CID, provider: Provider, options: AbortOptions): Promise<Uint8Array>

  /**
   * Turn a provider into a concise Uint8Array representation for use in a Bloom
   * filter
   */
  abstract toEvictionKey (provider: Provider): Uint8Array | string

  /**
   * Return `true` if we consider one provider to be the same as another
   */
  abstract equals (providerA: Provider, providerB: Provider): boolean
}
