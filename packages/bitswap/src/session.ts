import { AbstractSession, BloomFilter } from '@helia/utils'
import { CodeError } from '@libp2p/interface'
import pDefer, { type DeferredPromise } from 'p-defer'
import type { BitswapWantProgressEvents } from './index.js'
import type { Network } from './network.js'
import type { WantList, WantPresenceResult } from './want-list.js'
import type { CreateSessionOptions } from '@helia/interface'
import type { ComponentLogger, PeerId } from '@libp2p/interface'
import type { AbortOptions } from 'interface-store'
import type { CID } from 'multiformats/cid'

export interface BitswapSessionComponents {
  network: Network
  wantList: WantList
  logger: ComponentLogger
}

interface BitswapPeer {
  peerId: PeerId

  /**
   * We've failed to retrieve a block from this peer. This can happen when
   * protocol selection fails (e.g. they don't speak bitswap) - they should be
   * excluded from the session from now on.
   */
  failed: boolean
}

class BitswapSession extends AbstractSession<BitswapPeer, BitswapWantProgressEvents> {
  private readonly wantList: WantList
  private readonly network: Network
  private readonly filter: BloomFilter

  constructor (components: BitswapSessionComponents, init: CreateSessionOptions) {
    super(components, {
      ...init,
      name: 'helia:bitswap:session'
    })

    this.wantList = components.wantList
    this.network = components.network
    this.filter = BloomFilter.create(this.maxProviders)
  }

  async queryProvider (cid: CID, provider: BitswapPeer, options: AbortOptions): Promise<Uint8Array> {
    if (provider.failed) {
      throw new Error('Provider failed previously')
    }

    this.log('sending WANT-BLOCK for %c to %p', cid, provider.peerId)

    let result: WantPresenceResult

    try {
      result = await this.wantList.wantSessionBlock(cid, provider.peerId, options)
    } catch (err: any) {
      this.log('fetching %c from %p failed, excluding from session', cid, provider.peerId, err)
      provider.failed = true

      this.filter.add(provider.peerId.toBytes())
      this.providers.splice(this.providers.findIndex(prov => prov.peerId.equals(provider.peerId)), 1)

      throw err
    }

    this.log('%p %s %c', provider.peerId, result.has ? 'has' : 'does not have', cid)

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

          // dedupe existing session peers
          if (this.providers.find(prov => prov.peerId.equals(provider.id)) != null) {
            continue
          }

          // dedupe failed session peers
          if (this.filter.has(provider.id.toBytes())) {
            continue
          }

          const prov = {
            peerId: provider.id,
            failed: false
          }

          this.log('found %d/%d new providers', found, this.maxProviders)
          this.providers.push(prov)

          // let the new peer join current queries
          this.safeDispatchEvent('provider', {
            detail: prov
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

  includeProvider (provider: BitswapPeer): boolean {
    return !provider.failed
  }
}

export function createBitswapSession (components: BitswapSessionComponents, init: CreateSessionOptions): BitswapSession {
  return new BitswapSession(components, init)
}
