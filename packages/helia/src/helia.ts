import { start, stop } from '@libp2p/interface/startable'
import { logger } from '@libp2p/logger'
import drain from 'it-drain'
import { CustomProgressEvent } from 'progress-events'
import { bitswap, trustlessGateway } from './block-brokers/index.js'
import { PinsImpl } from './pins.js'
import { BlockStorage } from './storage.js'
import { assertDatastoreVersionIsCurrent } from './utils/datastore-version.js'
import { defaultHashers } from './utils/default-hashers.js'
import { NetworkedStorage } from './utils/networked-storage.js'
import type { HeliaInit } from '.'
import type { GCOptions, Helia } from '@helia/interface'
import type { Pins } from '@helia/interface/pins'
import type { Libp2p } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { Datastore } from 'interface-datastore'
import type { CID } from 'multiformats/cid'

const log = logger('helia')

interface HeliaImplInit<T extends Libp2p = Libp2p> extends HeliaInit<T> {
  libp2p: T
  blockstore: Blockstore
  datastore: Datastore
}

export class HeliaImpl implements Helia {
  public libp2p: Libp2p
  public blockstore: BlockStorage
  public datastore: Datastore
  public pins: Pins

  constructor (init: HeliaImplInit) {
    const hashers = defaultHashers(init.hashers)

    const components = {
      blockstore: init.blockstore,
      datastore: init.datastore,
      libp2p: init.libp2p,
      hashers
    }

    const blockBrokers = init.blockBrokers?.map((fn) => {
      return fn(components)
    }) ?? [
      bitswap()(components),
      trustlessGateway()()
    ]

    const networkedStorage = new NetworkedStorage(init.blockstore, {
      blockBrokers,
      hashers
    })

    this.pins = new PinsImpl(init.datastore, networkedStorage, init.dagWalkers ?? [])

    this.libp2p = init.libp2p
    this.blockstore = new BlockStorage(networkedStorage, this.pins, {
      holdGcLock: init.holdGcLock
    })
    this.datastore = init.datastore
  }

  async start (): Promise<void> {
    await assertDatastoreVersionIsCurrent(this.datastore)
    await start(this.blockstore)
    await this.libp2p.start()
  }

  async stop (): Promise<void> {
    await this.libp2p.stop()
    await stop(this.blockstore)
  }

  async gc (options: GCOptions = {}): Promise<void> {
    const releaseLock = await this.blockstore.lock.writeLock()

    try {
      const helia = this
      const blockstore = this.blockstore.unwrap()

      log('gc start')

      await drain(blockstore.deleteMany((async function * (): AsyncGenerator<CID> {
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
