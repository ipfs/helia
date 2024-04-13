import { AbstractSession } from '@helia/utils'
import { CodeError } from '@libp2p/interface'
import pDefer, { type DeferredPromise } from 'p-defer'
import type { BitswapWantProgressEvents } from './index.js'
import type { Network } from './network.js'
import type { WantList } from './want-list.js'
import type { CreateSessionOptions } from '@helia/interface'
import type { ComponentLogger, PeerId } from '@libp2p/interface'
import type { AbortOptions } from 'interface-store'
import type { CID } from 'multiformats/cid'

export interface BitswapSessionComponents {
  network: Network
  wantList: WantList
  logger: ComponentLogger
}

class BitswapSession extends AbstractSession<PeerId, BitswapWantProgressEvents> {
  private readonly wantList: WantList
  private readonly network: Network

  constructor (components: BitswapSessionComponents, init: CreateSessionOptions) {
    super(components, {
      ...init,
      name: 'helia:bitswap:session'
    })

    this.wantList = components.wantList
    this.network = components.network
  }

  async queryProvider (cid: CID, provider: PeerId, options: AbortOptions): Promise<Uint8Array> {
    this.log('sending WANT-BLOCK for %c to %p', cid, provider)

    const result = await this.wantList.wantSessionBlock(cid, provider, options)

    this.log('%p %s %c', provider, result.has ? 'has' : 'does not have', cid)

    if (result.has && result.block != null) {
      return result.block
    }

    throw new Error('Provider did not have block')
  }

  async findNewProviders (cid: CID, count: number, options: AbortOptions = {}): Promise<void> {
    const deferred: DeferredPromise<void> = pDefer()
    let found = 0

    // run async to resolve the deferred promise when `count` providers are
    // found but continue util this.providers reaches this.maxProviders
    void Promise.resolve()
      .then(async () => {
        this.log('finding %d-%d new provider(s) for %c', count, this.maxProviders, cid)

        for await (const provider of this.network.findProviders(cid, options)) {
          if (found === this.maxProviders || options.signal?.aborted === true) {
            break
          }

          if (this.hasProvider(provider.id)) {
            continue
          }

          this.log('found %d/%d new providers', found, this.maxProviders)
          this.providers.push(provider.id)

          // let the new peer join current queries
          this.safeDispatchEvent('provider', {
            detail: provider.id
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

        this.log('found %d/%d new session peers', found, this.maxProviders)

        if (found < count) {
          throw new CodeError(`Found ${found} of ${count} bitswap providers for ${cid}`, 'ERR_INSUFFICIENT_PROVIDERS_FOUND')
        }
      })
      .catch(err => {
        this.log.error('error searching routing for potential session peers for %c', cid, err.errors ?? err)
        deferred.reject(err)
      })

    return deferred.promise
  }

  toEvictionKey (provider: PeerId): Uint8Array | string {
    return provider.toBytes()
  }

  equals (providerA: PeerId, providerB: PeerId): boolean {
    return providerA.equals(providerB)
  }
}

export function createBitswapSession (components: BitswapSessionComponents, init: CreateSessionOptions): BitswapSession {
  return new BitswapSession(components, init)
}
