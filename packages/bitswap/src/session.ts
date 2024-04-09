import { CodeError } from '@libp2p/interface'
import { PeerSet } from '@libp2p/peer-collections'
import { PeerQueue } from '@libp2p/utils/peer-queue'
import map from 'it-map'
import merge from 'it-merge'
import pDefer, { type DeferredPromise } from 'p-defer'
import type { BitswapWantProgressEvents, BitswapSession as BitswapSessionInterface } from './index.js'
import type { Network } from './network.js'
import type { WantList } from './want-list.js'
import type { ComponentLogger, Logger, PeerId } from '@libp2p/interface'
import type { AbortOptions } from 'interface-store'
import type { CID } from 'multiformats/cid'
import type { ProgressOptions } from 'progress-events'

export interface BitswapSessionComponents {
  network: Network
  wantList: WantList
  logger: ComponentLogger
}

export interface BitswapSessionInit extends AbortOptions {
  root: CID
  queryConcurrency: number
  minProviders: number
  maxProviders: number
  connectedPeers: PeerId[]
}

class BitswapSession implements BitswapSessionInterface {
  public readonly root: CID
  public readonly peers: PeerSet
  private readonly log: Logger
  private readonly wantList: WantList
  private readonly network: Network
  private readonly queue: PeerQueue
  private readonly maxProviders: number

  constructor (components: BitswapSessionComponents, init: BitswapSessionInit) {
    this.peers = new PeerSet()
    this.root = init.root
    this.maxProviders = init.maxProviders
    this.log = components.logger.forComponent(`helia:bitswap:session:${init.root}`)
    this.wantList = components.wantList
    this.network = components.network

    this.queue = new PeerQueue({
      concurrency: init.queryConcurrency
    })
    this.queue.addEventListener('error', (evt) => {
      this.log.error('error querying peer for %c', this.root, evt.detail)
    })
  }

  async want (cid: CID, options: AbortOptions & ProgressOptions<BitswapWantProgressEvents> = {}): Promise<Uint8Array> {
    if (this.peers.size === 0) {
      throw new CodeError('Bitswap session had no peers', 'ERR_NO_SESSION_PEERS')
    }

    this.log('sending WANT-BLOCK for %c to', cid, this.peers)

    const result = await Promise.any(
      [...this.peers].map(async peerId => {
        return this.wantList.wantBlock(cid, {
          peerId,
          ...options
        })
      })
    )

    this.log('received block for %c from %p', cid, result.sender)

    // TODO findNewProviders when promise.any throws aggregate error and signal
    // is not aborted

    return result.block
  }

  async findNewProviders (cid: CID, count: number, options: AbortOptions = {}): Promise<void> {
    const deferred: DeferredPromise<void> = pDefer()
    let found = 0

    this.log('find %d-%d new provider(s) for %c', count, this.maxProviders, cid)

    const source = merge(
      [...this.wantList.peers.keys()],
      map(this.network.findProviders(cid, options), prov => prov.id)
    )

    void Promise.resolve()
      .then(async () => {
        for await (const peerId of source) {
          if (found === this.maxProviders) {
            this.queue.clear()
            break
          }

          // eslint-disable-next-line no-loop-func
          await this.queue.add(async () => {
            try {
              this.log('asking potential session peer %p if they have %c', peerId, cid)
              const result = await this.wantList.wantPresence(cid, {
                peerId,
                ...options
              })

              if (!result.has) {
                this.log('potential session peer %p did not have %c', peerId, cid)
                return
              }

              this.log('potential session peer %p had %c', peerId, cid)
              found++

              // add to list
              this.peers.add(peerId)

              if (found === count) {
                this.log('found %d session peers', found)

                deferred.resolve()
              }

              if (found === this.maxProviders) {
                this.log('found max provider session peers', found)

                this.queue.clear()
              }
            } catch (err: any) {
              this.log.error('error querying potential session peer %p for %c', peerId, cid, err.errors ?? err)
            }
          }, {
            peerId
          })
        }

        this.log('found %d session peers total', found)

        if (count > 0) {
          deferred.reject(new CodeError(`Found ${found} of ${count} providers`, 'ERR_NO_PROVIDERS_FOUND'))
        }
      })

    return deferred.promise
  }
}

export async function createBitswapSession (components: BitswapSessionComponents, init: BitswapSessionInit): Promise<BitswapSessionInterface> {
  const session = new BitswapSession(components, init)

  await session.findNewProviders(init.root, init.minProviders, {
    signal: init.signal
  })

  return session
}
