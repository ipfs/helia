import { createBitswap } from '@helia/bitswap'
import type { BitswapOptions, Bitswap, BitswapWantBlockProgressEvents, BitswapNotifyProgressEvents } from '@helia/bitswap'
import type { BlockAnnounceOptions, BlockBroker, BlockRetrievalOptions, CreateSessionOptions, Routing, HasherLoader } from '@helia/interface'
import type { Libp2p, Startable, ComponentLogger } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { CID } from 'multiformats/cid'
import type { MultihashHasher } from 'multiformats/hashes/interface'

export interface BitswapBlockBrokerComponents {
  libp2p: Libp2p
  blockstore: Blockstore
  routing: Routing
  logger: ComponentLogger
  getHasher: HasherLoader
}

export interface BitswapBlockBrokerInit extends BitswapOptions {

}

class BitswapBlockBroker implements BlockBroker<BitswapWantBlockProgressEvents, BitswapNotifyProgressEvents>, Startable {
  private readonly bitswap: Bitswap
  private started: boolean

  constructor (components: BitswapBlockBrokerComponents, init: BitswapBlockBrokerInit = {}) {
    const { getHasher } = components

    this.bitswap = createBitswap(components, {
      hashLoader: {
        getHasher: async (codecOrName: number): Promise<MultihashHasher<number>> => {
          return getHasher(codecOrName)
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

  async announce (cid: CID, block: Uint8Array, options?: BlockAnnounceOptions<BitswapNotifyProgressEvents>): Promise<void> {
    await this.bitswap.notify(cid, block, options)
  }

  async retrieve (cid: CID, options: BlockRetrievalOptions<BitswapWantBlockProgressEvents> = {}): Promise<Uint8Array> {
    return this.bitswap.want(cid, options)
  }

  createSession (options?: CreateSessionOptions<BitswapWantBlockProgressEvents>): BlockBroker<BitswapWantBlockProgressEvents, BitswapNotifyProgressEvents> {
    const session = this.bitswap.createSession(options)

    return {
      announce: async (cid, block, options) => {
        await this.bitswap.notify(cid, block, options)
      },

      retrieve: async (cid, options) => {
        return session.retrieve(cid, options)
      }
    }
  }
}

/**
 * A helper factory for users who want to override Helia `blockBrokers` but
 * still want to use the default `BitswapBlockBroker`.
 */
export function bitswap (init: BitswapBlockBrokerInit = {}): (components: BitswapBlockBrokerComponents) => BlockBroker {
  return (components) => new BitswapBlockBroker(components, init)
}
