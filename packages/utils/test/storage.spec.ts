import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import delay from 'delay'
import all from 'it-all'
import drain from 'it-drain'
import map from 'it-map'
import toBuffer from 'it-to-buffer'
import * as raw from 'multiformats/codecs/raw'
import { PinsImpl } from '../src/pins.js'
import { BlockStorage } from '../src/storage.js'
import { getCodec } from '../src/utils/get-codec.js'
import { createBlock } from './fixtures/create-block.js'
import type { Blocks, SessionBlockstore } from '@helia/interface'
import type { Pins } from '@helia/interface/pins'
import type { CID } from 'multiformats/cid'

class MemoryBlocks extends MemoryBlockstore implements Blocks {
  createSession (): SessionBlockstore {
    throw new Error('Not implemented')
  }
}

describe('storage', () => {
  let storage: BlockStorage
  let blockstore: Blocks
  let pins: Pins
  let blocks: Array<{ cid: CID, block: Uint8Array }>

  beforeEach(async () => {
    blocks = []

    for (let i = 0; i < 10; i++) {
      blocks.push(await createBlock(raw.code, Uint8Array.from([0, 1, 2, i])))
    }

    const datastore = new MemoryDatastore()

    blockstore = new MemoryBlocks()
    pins = new PinsImpl(datastore, blockstore, getCodec())
    storage = new BlockStorage(blockstore, pins, {
      holdGcLock: true
    })
  })

  it('gets a block from the blockstore', async () => {
    const { cid, block } = blocks[0]
    await blockstore.put(cid, block)

    const retrieved = await toBuffer(storage.get(cid))
    expect(retrieved).to.equalBytes(block)
  })

  it('aborts getting a block from the blockstore when passed an aborted signal', async () => {
    const { cid } = blocks[0]
    const controller = new AbortController()
    controller.abort()

    await expect(drain(storage.get(cid, {
      signal: controller.signal
    }))).to.eventually.be.rejected
      .with.property('name', 'AbortError')
  })

  it('gets many blocks from the blockstore', async () => {
    const count = 5

    for (let i = 0; i < count; i++) {
      const { cid, block } = blocks[i]
      await blockstore.put(cid, block)
    }

    const retrieved = await all(map(storage.getMany(async function * () {
      for (let i = 0; i < count; i++) {
        yield blocks[i].cid
        await delay(10)
      }
    }()), async ({ cid, bytes }) => {
      return {
        cid,
        block: await toBuffer(bytes)
      }
    }))

    expect(retrieved).to.deep.equal(new Array(count).fill(0).map((_, i) => blocks[i]))
  })

  it('aborts getting many blocks from the blockstore when passed an aborted signal', async () => {
    const { cid } = blocks[0]
    const controller = new AbortController()
    controller.abort()

    await expect(all(storage.getMany([cid], {
      signal: controller.signal
    }))).to.eventually.be.rejected
      .with.property('name', 'AbortError')
  })

  it('puts a block into the blockstore', async () => {
    const { cid, block } = blocks[0]
    await storage.put(cid, block)

    const retrieved = await toBuffer(blockstore.get(cid))
    expect(retrieved).to.equalBytes(block)
  })

  it('aborts putting a block into the blockstore when passed an aborted signal', async () => {
    const { cid, block } = blocks[0]
    const controller = new AbortController()
    controller.abort()

    await expect(storage.put(cid, block, {
      signal: controller.signal
    })).to.eventually.be.rejected
      .with.property('name', 'AbortError')
  })

  it('puts many blocks into the blockstore', async () => {
    const count = 5

    await drain(storage.putMany(async function * () {
      for (let i = 0; i < count; i++) {
        yield { cid: blocks[i].cid, bytes: blocks[i].block }
        await delay(10)
      }
    }()))

    const retrieved = await all(blockstore.getMany(new Array(count).fill(0).map((_, i) => blocks[i].cid)))
    expect(retrieved).to.deep.equal(retrieved)
  })

  it('aborts putting many blocks into the blockstore when passed an aborted signal', async () => {
    const { cid, block } = blocks[0]
    const controller = new AbortController()
    controller.abort()

    await expect(all(storage.putMany([{ cid, bytes: block }], {
      signal: controller.signal
    }))).to.eventually.be.rejected
      .with.property('name', 'AbortError')
  })
})
