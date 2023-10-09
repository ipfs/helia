import { createBitswap } from 'ipfs-bitswap'
import type { BlockProvider } from '@helia/interface/blocks'
import type { Libp2p } from '@libp2p/interface'
import type { Startable } from '@libp2p/interface/startable'
import type { Blockstore } from 'interface-blockstore'
import type { AbortOptions } from 'interface-store'
import type { Bitswap, BitswapNotifyProgressEvents, BitswapWantBlockProgressEvents } from 'ipfs-bitswap'
import type { CID } from 'multiformats/cid'
import type { MultihashHasher } from 'multiformats/hashes/interface'
import type { ProgressOptions } from 'progress-events'

export class BitswapBlockProvider implements BlockProvider<
ProgressOptions<BitswapNotifyProgressEvents>,
ProgressOptions<BitswapWantBlockProgressEvents>
>, Startable {
  private readonly bitswap: Bitswap
  private started: boolean

  constructor (libp2p: Libp2p, blockstore: Blockstore, hashers: MultihashHasher[]) {
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
      }
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

  notify (cid: CID, block: Uint8Array, options?: ProgressOptions<BitswapNotifyProgressEvents>): void {
    this.bitswap.notify(cid, block, options)
  }

  async get (cid: CID, options?: AbortOptions & ProgressOptions<BitswapWantBlockProgressEvents>): Promise<Uint8Array> {
    return this.bitswap.want(cid, options)
  }
}
