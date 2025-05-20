import { Queue } from '@libp2p/utils/queue'
import * as cborg from 'cborg'
import { Key } from 'interface-datastore'
import { base36 } from 'multiformats/bases/base36'
import { createUnsafe } from 'multiformats/block'
import { CID } from 'multiformats/cid'
import { CustomProgressEvent } from 'progress-events'
import { equals as uint8ArrayEquals } from 'uint8arrays/equals'
import type { CodecLoader } from '@helia/interface'
import type { GetBlockProgressEvents } from '@helia/interface/blocks'
import type { AddOptions, AddPinEvents, IsPinnedOptions, LsOptions, Pin, Pins, RmOptions } from '@helia/interface/pins'
import type { AbortOptions } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { Datastore } from 'interface-datastore'
import type { Version } from 'multiformats/cid'
import type { ProgressOptions } from 'progress-events'

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

/**
 * Callback for updating a {@link DatastorePinnedBlock}'s properties when
 * calling `#updatePinnedBlock`
 *
 * The callback should return `false` to prevent any pinning modifications to
 * the block, and true in all other cases.
 */
interface WithPinnedBlockCallback {
  (pinnedBlock: DatastorePinnedBlock): boolean
}

const DATASTORE_PIN_PREFIX = '/pin/'
const DATASTORE_BLOCK_PREFIX = '/pinned-block/'
const DATASTORE_ENCODING = base36
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
  private readonly getCodec: CodecLoader

  constructor (datastore: Datastore, blockstore: Blockstore, getCodec: CodecLoader) {
    this.datastore = datastore
    this.blockstore = blockstore
    this.getCodec = getCodec
  }

  async * add (cid: CID<unknown, number, number, Version>, options: AddOptions = {}): AsyncGenerator<CID, void, undefined> {
    const pinKey = toDSKey(cid)

    if (await this.datastore.has(pinKey)) {
      throw new Error('Already pinned')
    }

    const depth = Math.round(options.depth ?? Infinity)

    if (depth < 0) {
      throw new Error('Depth must be greater than or equal to 0')
    }

    // use a queue to walk the DAG instead of recursion so we can traverse very large DAGs
    const queue = new Queue<AsyncGenerator<CID>>({
      concurrency: DAG_WALK_QUEUE_CONCURRENCY
    })

    for await (const childCid of this.#walkDag(cid, queue, {
      ...options,
      depth
    })) {
      await this.#updatePinnedBlock(childCid, (pinnedBlock: DatastorePinnedBlock) => {
        // do not update pinned block if this block is already pinned by this CID
        if (pinnedBlock.pinnedBy.find(c => uint8ArrayEquals(c, cid.bytes)) != null) {
          return false
        }

        pinnedBlock.pinCount++
        pinnedBlock.pinnedBy.push(cid.bytes)
        return true
      }, options)

      yield childCid
    }

    const pin: DatastorePin = {
      depth,
      metadata: options.metadata ?? {}
    }

    await this.datastore.put(pinKey, cborg.encode(pin), options)
  }

  /**
   * Walk a DAG in an iterable fashion
   */
  async * #walkDag (cid: CID, queue: Queue<AsyncGenerator<CID>>, options: WalkDagOptions): AsyncGenerator<CID> {
    if (options.depth === -1) {
      return
    }

    const codec = await this.getCodec(cid.code)
    const bytes = await this.blockstore.get(cid, options)
    const block = createUnsafe({ bytes, cid, codec })

    yield cid

    // walk dag, ensure all blocks are present
    for (const [,cid] of block.links()) {
      yield * await queue.add(async () => {
        return this.#walkDag(cid, queue, {
          ...options,
          depth: options.depth - 1
        })
      })
    }
  }

  /**
   * Update the pin count for the CID
   */
  async #updatePinnedBlock (cid: CID, withPinnedBlock: WithPinnedBlockCallback, options: AddOptions): Promise<void> {
    const blockKey = new Key(`${DATASTORE_BLOCK_PREFIX}${DATASTORE_ENCODING.encode(cid.multihash.bytes)}`)

    let pinnedBlock: DatastorePinnedBlock = {
      pinCount: 0,
      pinnedBy: []
    }

    try {
      pinnedBlock = cborg.decode(await this.datastore.get(blockKey, options))
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        throw err
      }
    }

    const shouldContinue = withPinnedBlock(pinnedBlock)

    if (!shouldContinue) {
      return
    }

    if (pinnedBlock.pinCount === 0) {
      if (await this.datastore.has(blockKey)) {
        await this.datastore.delete(blockKey)
        return
      }
    }

    await this.datastore.put(blockKey, cborg.encode(pinnedBlock), options)
    options.onProgress?.(new CustomProgressEvent<CID>('helia:pin:add', cid))
  }

  async * rm (cid: CID<unknown, number, number, Version>, options: RmOptions = {}): AsyncGenerator<CID, void, undefined> {
    const pinKey = toDSKey(cid)
    const buf = await this.datastore.get(pinKey, options)
    const pin = cborg.decode(buf)

    await this.datastore.delete(pinKey, options)

    // use a queue to walk the DAG instead of recursion so we can traverse very large DAGs
    const queue = new Queue<AsyncGenerator<CID>>({
      concurrency: DAG_WALK_QUEUE_CONCURRENCY
    })

    for await (const childCid of this.#walkDag(cid, queue, {
      ...options,
      depth: pin.depth
    })) {
      await this.#updatePinnedBlock(childCid, (pinnedBlock): boolean => {
        pinnedBlock.pinCount--
        pinnedBlock.pinnedBy = pinnedBlock.pinnedBy.filter(c => uint8ArrayEquals(c, cid.bytes))
        return true
      }, {
        ...options,
        depth: pin.depth
      })

      yield childCid
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

  async get (cid: CID, options?: AbortOptions): Promise<Pin> {
    const pinKey = toDSKey(cid)
    const buf = await this.datastore.get(pinKey, options)

    return cborg.decode(buf)
  }

  async setMetadata (cid: CID, metadata: Record<string, string | number | boolean> | undefined, options?: AbortOptions): Promise<void> {
    const pinKey = toDSKey(cid)
    const buf = await this.datastore.get(pinKey, options)
    const pin: DatastorePin = cborg.decode(buf)

    pin.metadata = metadata ?? {}

    await this.datastore.put(pinKey, cborg.encode(pin), options)
  }
}
