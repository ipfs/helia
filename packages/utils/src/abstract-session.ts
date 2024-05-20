import { DEFAULT_SESSION_MIN_PROVIDERS, DEFAULT_SESSION_MAX_PROVIDERS } from '@helia/interface'
import { CodeError, TypedEventEmitter, setMaxListeners } from '@libp2p/interface'
import { Queue } from '@libp2p/utils/queue'
import { base64 } from 'multiformats/bases/base64'
import pDefer from 'p-defer'
import { BloomFilter } from './bloom-filter.js'
import type { BlockBroker, BlockRetrievalOptions, CreateSessionOptions } from '@helia/interface'
import type { AbortOptions, ComponentLogger, Logger } from '@libp2p/interface'
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
  private intialPeerSearchComplete?: Promise<void>
  private readonly requests: Map<string, Promise<Uint8Array>>
  private readonly name: string
  protected log: Logger
  protected logger: ComponentLogger
  private readonly minProviders: number
  private readonly maxProviders: number
  public readonly providers: Provider[]
  private readonly evictionFilter: BloomFilter
  findProviderQueue: Queue<void, AbortOptions>
  queryProviderQueue: Queue<Uint8Array, { provider: Provider, priority?: number } & AbortOptions>

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
    this.evictionFilter = BloomFilter.create(this.maxProviders)
    this.findProviderQueue = new Queue({
      concurrency: 1
    })
    this.queryProviderQueue = new Queue({
      concurrency: this.maxProviders
    })
  }

  async retrieve (cid: CID, options: BlockRetrievalOptions<RetrieveBlockProgressEvents> = {}): Promise<Uint8Array> {
    // see if we are already requesting this CID in this session
    const cidStr = base64.encode(cid.multihash.bytes)
    const existingJob = this.requests.get(cidStr)

    if (existingJob != null) {
      this.log('join existing request for %c', cid)
      return existingJob
    }
    let foundBlock = false
    const deferred: DeferredPromise<Uint8Array> = pDefer()
    this.requests.set(cidStr, deferred.promise)

    const peerAddedToSessionListener = (event: CustomEvent<Provider>): void => {
      this.log('peer added to session...')
      this.addQueryProviderJob(cid, event.detail, options)
    }

    // add new session peers to query as they are discovered
    this.addEventListener('provider', peerAddedToSessionListener)

    if (this.providers.length === 0) {
      let first = false

      if (this.intialPeerSearchComplete == null) {
        first = true
        this.log = this.logger.forComponent(`${this.name}:${cid}`)
        this.intialPeerSearchComplete = this.findProviders(cid, this.minProviders, options)
      }

      await this.intialPeerSearchComplete

      if (first) {
        this.log('found initial session peers for %c', cid)
      }
    } else {
      /**
       * Query all existing providers.
       *
       * This is really only used when querying for subsequent blocks in the same
       * session. e.g. You create the session for CID bafy1234, and then you want
       * to retrieve bafy5678 from the same session. This call makes sure that we
       * initially query the existing providers for the new CID before we start
       * finding new providers.
       */
      void Promise.all([...this.providers].map(async (provider) => {
        this.log('querying existing provider %o', this.toEvictionKey(provider))
        return this.addQueryProviderJob(cid, provider, options)
      }))
    }

    let findProvidersErrored = false
    this.findProviderQueue.addEventListener('failure', (evt) => {
      this.log.error('error finding new providers for %c', cid, evt.detail.error)

      findProvidersErrored = true
      if (['ERR_INSUFFICIENT_PROVIDERS_FOUND'].includes((evt.detail.error as CodeError).code)) {
        deferred.reject(evt.detail.error)
      }
    })

    this.findProviderQueue.addEventListener('idle', () => {
      this.log.trace('findProviderQueue idle')
      if (options.signal?.aborted === true && !foundBlock) {
        deferred.reject(new CodeError(options.signal.reason, 'ABORT_ERR'))
        return
      }

      if (foundBlock || findProvidersErrored || options.signal?.aborted === true) {
        return
      }
      // continuously find new providers while we haven't found the block and signal is not aborted
      this.addFindProviderJob(cid, options)
    })

    this.queryProviderQueue.addEventListener('failure', (evt) => {
      this.log.error('error querying provider %o, evicting from session', evt.detail.job.options.provider, evt.detail.error)
      this.evict(evt.detail.job.options.provider)
    })

    this.queryProviderQueue.addEventListener('success', (event) => {
      this.log.trace('queryProviderQueue success')
      foundBlock = true
      // this.findProviderQueue.clear()
      deferred.resolve(event.detail.result)
    })

    this.queryProviderQueue.addEventListener('idle', () => {
      this.log.trace('queryProviderQueue is idle')
      if (foundBlock) {
        return
      }
      if (options.signal?.aborted === true) {
        // if the signal was aborted, we should reject the request
        deferred.reject(options.signal.reason)
        return
      }
      // we're done querying found providers.. if we can't find new providers, we should reject
      if (findProvidersErrored) {
        deferred.reject(new CodeError('Done querying all found providers and unable to retrieve the block', 'ERR_NO_PROVIDERS_HAD_BLOCK'))
        return
      }
      // otherwise, we're still waiting for more providers to query
      this.log('waiting for more providers to query')
      // if this.findProviders is not running, start it
      if (this.findProviderQueue.running === 0) {
        this.addFindProviderJob(cid, options)
      }
    })

    try {
      // this.intialPeerSearchComplete = this.findProviders(cid, this.minProviders, options)
      return await deferred.promise
    } finally {
      this.log('finally block, cleaning up session')
      this.removeEventListener('provider', peerAddedToSessionListener)
      this.findProviderQueue.clear()
      this.queryProviderQueue.clear()
      this.requests.delete(cidStr)
    }
  }

  addFindProviderJob (cid: CID, options: AbortOptions): any {
    return this.findProviderQueue.add(async () => {
      await this.findProviders(cid, this.minProviders, options)
    }, { signal: options.signal })
      .catch(err => {
        if (options.signal?.aborted === true) {
        // skip logging error if signal was aborted because abort can happen
        // on success (e.g. another session found the block)
          return
        }
        this.log.error('could not find new providers for %c', cid, err)
      })
  }

  addQueryProviderJob (cid: CID, provider: Provider, options: AbortOptions): any {
    return this.queryProviderQueue.add(async () => {
      return this.queryProvider(cid, provider, options)
    }, {
      provider,
      signal: options.signal
    }).catch(err => {
      if (options.signal?.aborted === true) {
        // skip logging error if signal was aborted because abort can happen
        // on success (e.g. another session found the block)
        return
      }
      this.log.error('error retrieving session block for %c', cid, err)
    })
  }

  evict (provider: Provider): void {
    this.evictionFilter.add(this.toEvictionKey(provider))
    this.log('provider added to evictionFilter')
    const index = this.providers.findIndex(prov => this.equals(prov, provider))
    this.log('index of provider in this.providers: %d', index)

    if (index === -1) {
      this.log('tried to evict provider, but it was not in this.providers')
      return
    }

    this.providers.splice(index, 1)
  }

  isEvicted (provider: Provider): boolean {
    return this.evictionFilter.has(this.toEvictionKey(provider))
  }

  hasProvider (provider: Provider): boolean {
    // dedupe existing gateways
    if (this.providers.some(prov => this.equals(prov, provider))) {
      return true
    }

    // dedupe failed session peers
    if (this.isEvicted(provider)) {
      return true
    }

    return false
  }

  /**
   * @param cid - The CID of the block to find providers for
   * @param count - The number of providers to find
   * @param options - AbortOptions
   * @returns
   */
  private async findProviders (cid: CID, count: number, options: AbortOptions): Promise<void> {
    this.log('findProviders called')
    const deferred: DeferredPromise<void> = pDefer()
    let found = 0

    // run async to resolve the deferred promise when `count` providers are
    // found but continue util this.providers reaches this.maxProviders
    void Promise.resolve()
      .then(async () => {
        this.log('finding %d-%d new provider(s) for %c', count, this.maxProviders, cid)

        for await (const provider of this.findNewProviders(cid, options)) {
          this.log('found new provider %o', this.toEvictionKey(provider))
          // options.signal?.throwIfAborted()
          if (this.providers.length === this.maxProviders || options.signal?.aborted === true) {
          // if (this.providers.length === this.maxProviders) {
            break
          }

          if (this.hasProvider(provider)) {
            this.log('ignoring duplicate provider')
            continue
          } else {
            this.log('provider is not a duplicate')
          }

          found++
          this.log('found %d/%d new providers, (total=%d)', found, this.maxProviders, found + this.providers.length)
          // this.providers.push(provider)
          // this.providerMap.set(this.toEvictionKey(provider), provider)
          this.providers.push(provider)

          // let the new peer join current queries
          this.safeDispatchEvent('provider', {
            detail: provider
          })
          this.log('emitted provider event')

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

        this.log('found %d/%d new session peers', found, this.maxProviders)

        if (found < count) {
          throw new CodeError(`Found ${found} of ${count} ${this.name} providers for ${cid}`, 'ERR_INSUFFICIENT_PROVIDERS_FOUND')
        }
      })
      .catch(err => {
        this.log.error('error searching routing for potential session peers for %c', cid, err.errors ?? err)
        deferred.reject(err)
      })

    return deferred.promise
  }

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
