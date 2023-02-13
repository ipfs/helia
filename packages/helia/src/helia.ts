import type { Helia, InfoResponse } from '@helia/interface'
import type { Libp2p } from '@libp2p/interface-libp2p'
import type { Blockstore } from 'interface-blockstore'
import type { Datastore } from 'interface-datastore'
import { identity } from 'multiformats/hashes/identity'
import { sha256, sha512 } from 'multiformats/hashes/sha2'
import type { MultihashHasher } from 'multiformats/hashes/interface'
import type { HeliaInit } from '.'
import { Bitswap, createBitswap } from 'ipfs-bitswap'
import { BlockStorage } from './storage.js'

export class HeliaImpl implements Helia {
  public libp2p: Libp2p
  public blockstore: Blockstore
  public datastore: Datastore

  #bitswap: Bitswap

  constructor (init: HeliaInit) {
    const hashers: MultihashHasher[] = [
      sha256,
      sha512,
      identity,
      ...(init.hashers ?? [])
    ]

    this.#bitswap = createBitswap(init.libp2p, init.blockstore, {
      hashLoader: {
        getHasher: async (codecOrName: string | number) => {
          const hasher = hashers.find(hasher => {
            return hasher.code === codecOrName || hasher.name === codecOrName
          })

          if (hasher != null) {
            return await Promise.resolve(hasher)
          }

          throw new Error(`Could not load hasher for code/name "${codecOrName}"`)
        }
      }
    })

    this.libp2p = init.libp2p
    this.blockstore = new BlockStorage(init.blockstore, this.#bitswap)
    this.datastore = init.datastore
  }

  async start (): Promise<void> {
    this.#bitswap.start()
    await this.libp2p.start()
  }

  async stop (): Promise<void> {
    this.#bitswap.stop()
    await this.libp2p.stop()
  }

  async info (): Promise<InfoResponse> {
    return {
      peerId: this.libp2p.peerId,
      multiaddrs: this.libp2p.getMultiaddrs(),
      agentVersion: this.libp2p.identifyService.host.agentVersion,
      protocolVersion: this.libp2p.identifyService.host.protocolVersion,
      protocols: this.libp2p.getProtocols(),
      status: this.libp2p.isStarted() ? 'running' : 'stopped'
    }
  }
}
