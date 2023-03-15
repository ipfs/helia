import type { GCOptions, Helia } from '@helia/interface'
import type { Libp2p } from '@libp2p/interface-libp2p'
import type { Datastore } from 'interface-datastore'
import type { CID } from 'multiformats/cid'
import { identity } from 'multiformats/hashes/identity'
import { sha256, sha512 } from 'multiformats/hashes/sha2'
import type { MultihashHasher } from 'multiformats/hashes/interface'
import type { HeliaInit } from '.'
import { Bitswap, createBitswap } from 'ipfs-bitswap'
import { BlockStorage } from './storage.js'
import type { Pins } from '@helia/interface/pins'
import { PinsImpl } from './pins.js'
import { assertDatastoreVersionIsCurrent } from './utils/datastore-version.js'
import drain from 'it-drain'
import { CustomProgressEvent } from 'progress-events'
import { MemoryDatastore } from 'datastore-core'
import { MemoryBlockstore } from 'blockstore-core'
import { logger } from '@libp2p/logger'

const log = logger('helia')

export class HeliaImpl implements Helia {
  public libp2p: Libp2p
  public blockstore: BlockStorage
  public datastore: Datastore
  public pins: Pins

  #bitswap?: Bitswap

  constructor (init: HeliaInit) {
    const hashers: MultihashHasher[] = [
      sha256,
      sha512,
      identity,
      ...(init.hashers ?? [])
    ]

    const datastore = init.datastore ?? new MemoryDatastore()
    const blockstore = init.blockstore ?? new MemoryBlockstore()

    // @ts-expect-error incomplete libp2p implementation
    const libp2p = init.libp2p ?? new Proxy<Libp2p>({}, {
      get (_, prop) {
        const noop = (): void => {}
        const noops = ['start', 'stop']

        if (noops.includes(prop.toString())) {
          return noop
        }

        if (prop === 'isProxy') {
          return true
        }

        throw new Error('Please configure Helia with a libp2p instance')
      },
      set () {
        throw new Error('Please configure Helia with a libp2p instance')
      }
    })

    if (init.libp2p != null) {
      this.#bitswap = createBitswap(libp2p, blockstore, {
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
    }

    this.pins = new PinsImpl(datastore, blockstore, init.dagWalkers ?? [])

    this.libp2p = libp2p
    this.blockstore = new BlockStorage(blockstore, this.pins, {
      bitswap: this.#bitswap,
      holdGcLock: init.holdGcLock
    })
    this.datastore = datastore
  }

  async start (): Promise<void> {
    await assertDatastoreVersionIsCurrent(this.datastore)

    await this.#bitswap?.start()
    await this.libp2p.start()
  }

  async stop (): Promise<void> {
    await this.libp2p.stop()
    await this.#bitswap?.stop()
  }

  async gc (options: GCOptions = {}): Promise<void> {
    const releaseLock = await this.blockstore.lock.writeLock()

    try {
      const helia = this
      const blockstore = this.blockstore.unwrap()

      log('gc start')

      await drain(blockstore.deleteMany((async function * () {
        for await (const { cid } of blockstore.getAll()) {
          try {
            if (await helia.pins.isPinned(cid, options)) {
              continue
            }

            yield cid

            options.onProgress?.(new CustomProgressEvent<CID>('helia:gc:deleted', cid))
          } catch (err) {
            log.error('Error during gc', err)
            options.onProgress?.(new CustomProgressEvent<Error>('helia:gc:error', err))
          }
        }
      }())))
    } finally {
      releaseLock()
    }

    log('gc finished')
  }
}
