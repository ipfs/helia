import * as cborg from 'cborg'
import { type Datastore, Key } from 'interface-datastore'
import { base36 } from 'multiformats/bases/base36'
import { CID, type Version } from 'multiformats/cid'
import { CustomProgressEvent } from 'progress-events'
import { equals as uint8ArrayEquals } from 'uint8arrays/equals'
import { cborWalker, dagPbWalker, jsonWalker, rawWalker } from './utils/dag-walkers.js'
import type { DAGWalker } from './index.js'
import type { AddOptions, IsPinnedOptions, LsOptions, Pin, Pins, RmOptions } from '@helia/interface/pins'
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

interface CIDQueueItem {
  cid: CID
  depth: number
}

const DATASTORE_PIN_PREFIX = '/pin/'
const DATASTORE_BLOCK_PREFIX = '/pinned-block/'
const DATASTORE_ENCODING = base36

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

  async * add (cid: CID<unknown, number, number, Version>, options: AddOptions = {}): AsyncGenerator<CID[], Pin, number | undefined> {
    const pinKey = toDSKey(cid)

    if (await this.datastore.has(pinKey)) {
      throw new Error('Already pinned')
    }

    const depth = Math.round(options.depth ?? Infinity)

    if (depth < 0) {
      throw new Error('Depth must be greater than or equal to 0')
    }

    let batch = Math.round(options.batch ?? Infinity)

    if (batch < 1) {
      throw new Error('Batch must be greater than or equal to 1')
    }

    // use a queue to walk the DAG instead of recursion so we can traverse very large DAGs
    const queue: CIDQueueItem[] = [{ cid, depth: 0 }]

    while (queue.length !== 0) {
      const cids = await this.#pullManyFromQueue(queue, depth, batch, options)

      await Promise.all(cids.map(async cid =>
        this.#updatePinnedBlock(cid, (pinnedBlock): void => {
          // do not update pinned block if this block is already pinned by this CID
          if (pinnedBlock.pinnedBy.find(c => uint8ArrayEquals(c, cid.bytes)) != null) {
            return
          }

          pinnedBlock.pinCount++
          pinnedBlock.pinnedBy.push(cid.bytes)
        }, options)
      ))

      const newBatch = yield cids

      if (newBatch != null && newBatch >= 1) {
        batch = Math.round(newBatch)
      }
    }

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
   * Pull a block from the queue enqueing others.
   */
  async #pullFromQueue (queue: CIDQueueItem[], depth: number, options: AbortOptions): Promise<CID> {
    const item = queue.shift()

    if (item == null) {
      throw new Error('queue is empty')
    }

    const dagWalker = this.dagWalkers[item.cid.code]

    if (dagWalker == null) {
      throw new Error(`No dag walker found for cid codec ${item.cid.code}`)
    }

    const block = await this.blockstore.get(item.cid, options)

    if (item.depth < depth) {
      for await (const cid of dagWalker.walk(block)) {
        queue.push({ cid, depth: item.depth + 1 })
      }
    }

    return item.cid
  }

  /**
   * Pull multiple blocks from the queue in one go.
   */
  async #pullManyFromQueue (queue: CIDQueueItem[], depth: number, batch: number, options: AbortOptions): Promise<CID[]> {
    const promises: Array<Promise<CID>> = []
    const results: CID[] = []

    for (let i = 0; i < batch; i++) {
      if (queue.length === 0) {
        const promise = promises.shift()

        if (promise == null) {
          break
        }

        results.push(await promise)
        i--
        continue
      }

      promises.push(this.#pullFromQueue(queue, depth, options))
    }

    return [...results, ...(await Promise.all(promises))]
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

  async * rm (cid: CID<unknown, number, number, Version>, options: RmOptions = {}): AsyncGenerator<CID, Pin> {
    const pinKey = toDSKey(cid)
    const buf = await this.datastore.get(pinKey, options)
    const pin = cborg.decode(buf)

    await this.datastore.delete(pinKey, options)

    // use a queue to walk the DAG instead of recursion so we can traverse very large DAGs
    const queue: CIDQueueItem[] = [{ cid, depth: 0 }]

    while (queue.length !== 0) {
      const cid = await this.#pullFromQueue(queue, pin.depth, options)

      await this.#updatePinnedBlock(cid, (pinnedBlock): void => {
        pinnedBlock.pinCount--
        pinnedBlock.pinnedBy = pinnedBlock.pinnedBy.filter(c => uint8ArrayEquals(c, cid.bytes))
      }, {
        ...options,
        depth: pin.depth
      })

      yield cid
    }

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
