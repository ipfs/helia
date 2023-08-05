import * as cborg from 'cborg'
import { type Datastore, Key } from 'interface-datastore'
import { base36 } from 'multiformats/bases/base36'
import { CID, type Version } from 'multiformats/cid'
import defer from 'p-defer'
import PQueue from 'p-queue'
import { CustomProgressEvent, type ProgressOptions } from 'progress-events'
import { equals as uint8ArrayEquals } from 'uint8arrays/equals'
import { cborWalker, dagPbWalker, jsonWalker, rawWalker } from './utils/dag-walkers.js'
import type { DAGWalker } from './index.js'
import type { AddOptions, AddPinEvents, IsPinnedOptions, LsOptions, Pin, Pins, RmOptions } from '@helia/interface/pins'
import type { GetBlockProgressEvents } from '@helia/interface/src/blocks.js'
import type { AbortOptions } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'

const DEFAULT_DAG_WALKERS = [
  rawWalker,
  dagPbWalker,
  cborWalker,
  jsonWalker
]

interface DatastorePin {
  /**
   * 0 for a direct pin or an arbitrary (+ve, whole) number or Infinity
   */
  depth: number

  /**
   * User-specific metadata for the pin
   */
  metadata: Record<string, string | number | boolean>
}

interface DatastorePinnedBlock {
  pinCount: number
  pinnedBy: Uint8Array[]
}

const DATASTORE_PIN_PREFIX = '/pin/'
const DATASTORE_BLOCK_PREFIX = '/pinned-block/'
const DATASTORE_ENCODING = base36
// const DAG_WALK_MAX_QUEUE_LENGTH = 10
const DAG_WALK_QUEUE_CONCURRENCY = 1

interface WalkDagOptions extends AbortOptions, ProgressOptions<GetBlockProgressEvents | AddPinEvents> {
  depth: number
}

function toDSKey (cid: CID): Key {
  if (cid.version === 0) {
    cid = cid.toV1()
  }

  return new Key(`${DATASTORE_PIN_PREFIX}${cid.toString(DATASTORE_ENCODING)}`)
}

export class PinsImpl implements Pins {
  private readonly datastore: Datastore
  private readonly blockstore: Blockstore
  private dagWalkers: Record<number, DAGWalker>

  constructor (datastore: Datastore, blockstore: Blockstore, dagWalkers: DAGWalker[]) {
    this.datastore = datastore
    this.blockstore = blockstore
    this.dagWalkers = {}

    ;[...DEFAULT_DAG_WALKERS, ...dagWalkers].forEach(dagWalker => {
      this.dagWalkers[dagWalker.codec] = dagWalker
    })
  }

  async add (cid: CID<unknown, number, number, Version>, options: AddOptions = {}): Promise<Pin> {
    const pinKey = toDSKey(cid)

    if (await this.datastore.has(pinKey)) {
      throw new Error('Already pinned')
    }

    const depth = Math.round(options.depth ?? Infinity)

    if (depth < 0) {
      throw new Error('Depth must be greater than or equal to 0')
    }

    // use a queue to walk the DAG instead of recursion so we can traverse very large DAGs
    const queue = new PQueue({
      concurrency: DAG_WALK_QUEUE_CONCURRENCY
    })
    void queue.add(async (): Promise<void> => {
      await this.#walkDag(cid, queue, (pinnedBlock): void => {
        // do not update pinned block if this block is already pinned by this CID
        if (pinnedBlock.pinnedBy.find(c => uint8ArrayEquals(c, cid.bytes)) != null) {
          return
        }

        pinnedBlock.pinCount++
        pinnedBlock.pinnedBy.push(cid.bytes)
      }, {
        ...options,
        depth
      })
    })

    // if a job in the queue errors, throw that error
    const deferred = defer()

    queue.on('error', (err): void => {
      queue.clear()
      deferred.reject(err)
    })

    // wait for the queue to complete or error
    await Promise.race([
      queue.onIdle(),
      deferred.promise
    ])

    const pin: DatastorePin = {
      depth,
      metadata: options.metadata ?? {}
    }

    await this.datastore.put(pinKey, cborg.encode(pin), options)

    return {
      cid,
      ...pin
    }
  }

  /**
   * Walk the DAG behind the passed CID, ensure all blocks are present in the blockstore
   * and update the pin count for them
   */
  async #walkDag (cid: CID, queue: PQueue, withPinnedBlock: (pinnedBlock: DatastorePinnedBlock) => void, options: WalkDagOptions): Promise<void> {
    if (options.depth === -1) {
      return
    }

    const dagWalker = this.dagWalkers[cid.code]

    if (dagWalker == null) {
      throw new Error(`No dag walker found for cid codec ${cid.code}`)
    }

    const block = await this.blockstore.get(cid, options)

    await this.#updatePinnedBlock(cid, withPinnedBlock, options)

    // walk dag, ensure all blocks are present
    for await (const cid of dagWalker.walk(block)) {
      void queue.add(async () => {
        await this.#walkDag(cid, queue, withPinnedBlock, {
          ...options,
          depth: options.depth - 1
        })
      })
    }
  }

  /**
   * Update the pin count for the CID
   */
  async #updatePinnedBlock (cid: CID, withPinnedBlock: (pinnedBlock: DatastorePinnedBlock) => void, options: AddOptions): Promise<void> {
    const blockKey = new Key(`${DATASTORE_BLOCK_PREFIX}${DATASTORE_ENCODING.encode(cid.multihash.bytes)}`)

    let pinnedBlock: DatastorePinnedBlock = {
      pinCount: 0,
      pinnedBy: []
    }

    try {
      pinnedBlock = cborg.decode(await this.datastore.get(blockKey, options))
    } catch (err: any) {
      if (err.code !== 'ERR_NOT_FOUND') {
        throw err
      }
    }

    withPinnedBlock(pinnedBlock)

    if (pinnedBlock.pinCount === 0) {
      if (await this.datastore.has(blockKey)) {
        await this.datastore.delete(blockKey)
        return
      }
    }

    await this.datastore.put(blockKey, cborg.encode(pinnedBlock), options)
    options.onProgress?.(new CustomProgressEvent<CID>('helia:pin:add', { detail: cid }))
  }

  async rm (cid: CID<unknown, number, number, Version>, options: RmOptions = {}): Promise<Pin> {
    const pinKey = toDSKey(cid)
    const buf = await this.datastore.get(pinKey, options)
    const pin = cborg.decode(buf)

    await this.datastore.delete(pinKey, options)

    // use a queue to walk the DAG instead of recursion so we can traverse very large DAGs
    const queue = new PQueue({
      concurrency: DAG_WALK_QUEUE_CONCURRENCY
    })
    void queue.add(async (): Promise<void> => {
      await this.#walkDag(cid, queue, (pinnedBlock): void => {
        pinnedBlock.pinCount--
        pinnedBlock.pinnedBy = pinnedBlock.pinnedBy.filter(c => uint8ArrayEquals(c, cid.bytes))
      }, {
        ...options,
        depth: pin.depth
      })
    })
    await queue.onIdle()

    return {
      cid,
      ...pin
    }
  }

  async * ls (options: LsOptions = {}): AsyncGenerator<Pin, void, undefined> {
    for await (const { key, value } of this.datastore.query({
      prefix: DATASTORE_PIN_PREFIX + (options.cid != null ? `${options.cid.toString(base36)}` : '')
    }, options)) {
      const cid = CID.parse(key.toString().substring(5), base36)
      const pin = cborg.decode(value)

      yield {
        cid,
        ...pin
      }
    }
  }

  async isPinned (cid: CID, options: IsPinnedOptions = {}): Promise<boolean> {
    const blockKey = new Key(`${DATASTORE_BLOCK_PREFIX}${DATASTORE_ENCODING.encode(cid.multihash.bytes)}`)

    return this.datastore.has(blockKey, options)
  }
}
