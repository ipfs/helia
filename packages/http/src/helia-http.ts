import { start, stop } from '@libp2p/interface'
import drain from 'it-drain'
import { CustomProgressEvent } from 'progress-events'
import { trustlessGateway, NetworkedStorage } from '@helia/block-brokers'
import { PinsImpl } from './pins.js'
import { BlockStorage } from './storage.js'
import { assertDatastoreVersionIsCurrent } from './utils/datastore-version.js'
import { defaultHashers } from './utils/default-hashers.js'

import type { HeliaHTTPInit } from '.'
import type { GCOptions, HeliaHTTP } from '@helia/interface/http'
import type { Pins } from '@helia/interface/pins'
import type { ComponentLogger, Logger } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { Datastore } from 'interface-datastore'
import type { CID } from 'multiformats/cid'
import { defaultLogger } from '@libp2p/logger'

interface HeliaHTTPImplInit extends HeliaHTTPInit {
  blockstore: Blockstore
  datastore: Datastore
}

export class HeliaHTTPImpl implements HeliaHTTP {
  public blockstore: BlockStorage
  public datastore: Datastore
  public pins: Pins
  public logger: ComponentLogger
  private readonly log: Logger

  constructor (init: HeliaHTTPImplInit) {
    this.logger = init.logger ?? defaultLogger()
    this.log = this.logger.forComponent('helia:http')
    const hashers = defaultHashers(init.hashers)

    const components = {
      blockstore: init.blockstore,
      datastore: init.datastore,
      hashers,
      logger: this.logger
    }

    const blockBrokers = init.blockBrokers?.map((fn) => {
      return fn(components)
    }) ?? [
      trustlessGateway()(components)
    ]

    const networkedStorage = new NetworkedStorage(components, {
      blockBrokers,
      hashers
    })

    this.pins = new PinsImpl(init.datastore, networkedStorage, init.dagWalkers ?? [])

    this.blockstore = new BlockStorage(networkedStorage, this.pins, {
      holdGcLock: init.holdGcLock
    })
    this.datastore = init.datastore
  }

  async start (): Promise<void> {
    await assertDatastoreVersionIsCurrent(this.datastore)
    await start(this.blockstore)
  }

  async stop (): Promise<void> {
    await stop(this.blockstore)
  }

  async gc (options: GCOptions = {}): Promise<void> {
    const releaseLock = await this.blockstore.lock.writeLock()

    try {
      const heliaHTTP = this
      const blockstore = this.blockstore.unwrap()

      this.log('gc start')

      await drain(blockstore.deleteMany((async function * (): AsyncGenerator<CID> {
        for await (const { cid } of blockstore.getAll()) {
          try {
            if (await heliaHTTP.pins.isPinned(cid, options)) {
              continue
            }

            yield cid

            options.onProgress?.(new CustomProgressEvent<CID>('heliaHTTP:gc:deleted', cid))
          } catch (err) {
            heliaHTTP.log.error('Error during gc', err)
            options.onProgress?.(new CustomProgressEvent<Error>('heliaHTTP:gc:error', err))
          }
        }
      }())))
    } finally {
      releaseLock()
    }

    this.log('gc finished')
  }
}
