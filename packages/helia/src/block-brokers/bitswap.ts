import { createBitswap } from 'ipfs-bitswap'
import type { BlockAnnouncer, BlockBroker, BlockRetrievalOptions, BlockRetriever } from '@helia/interface/blocks'
import type { Libp2p } from '@libp2p/interface'
import type { Startable } from '@libp2p/interface/startable'
import type { Blockstore } from 'interface-blockstore'
import type { Bitswap, BitswapNotifyProgressEvents, BitswapOptions, BitswapWantBlockProgressEvents } from 'ipfs-bitswap'
import type { CID } from 'multiformats/cid'
import type { MultihashHasher } from 'multiformats/hashes/interface'
import type { ProgressOptions } from 'progress-events'

interface BitswapComponents {
  libp2p: Libp2p
  blockstore: Blockstore
  hashers: MultihashHasher[]
}

export interface BitswapInit extends BitswapOptions {

}

class BitswapBlockBroker implements BlockAnnouncer<ProgressOptions<BitswapNotifyProgressEvents>>, BlockRetriever<
ProgressOptions<BitswapWantBlockProgressEvents>
>, Startable {
  private readonly bitswap: Bitswap
  private started: boolean

  constructor (components: BitswapComponents, init: BitswapInit = {}) {
    const { libp2p, blockstore, hashers } = components

    this.bitswap = createBitswap(libp2p, blockstore, {
      hashLoader: {
        getHasher: async (codecOrName: string | number): Promise<MultihashHasher<number>> => {
          const hasher = hashers.find(hasher => {
            return hasher.code === codecOrName || hasher.name === codecOrName
          })

          if (hasher != null) {
            return hasher
          }

          throw new Error(`Could not load hasher for code/name "${codecOrName}"`)
        }
      },
      ...init
    })
    this.started = false
  }

  isStarted (): boolean {
    return this.started
  }

  async start (): Promise<void> {
    await this.bitswap.start()
    this.started = true
  }

  async stop (): Promise<void> {
    await this.bitswap.stop()
    this.started = false
  }

  announce (cid: CID, block: Uint8Array, options?: ProgressOptions<BitswapNotifyProgressEvents>): void {
    this.bitswap.notify(cid, block, options)
  }

  async retrieve (cid: CID, { validateFn, ...options }: BlockRetrievalOptions<ProgressOptions<BitswapWantBlockProgressEvents>> = {}): Promise<Uint8Array> {
    return this.bitswap.want(cid, options)
  }
}

/**
 * A helper factory for users who want to override Helia `blockBrokers` but
 * still want to use the default `BitswapBlockBroker`.
 */
export function bitswap (init: BitswapInit = {}): (components: BitswapComponents) => BlockBroker {
  return (components) => new BitswapBlockBroker(components, init)
}
