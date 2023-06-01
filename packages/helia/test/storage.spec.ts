/* eslint-env mocha */

import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import delay from 'delay'
import all from 'it-all'
import drain from 'it-drain'
import * as raw from 'multiformats/codecs/raw'
import { PinsImpl } from '../src/pins.js'
import { BlockStorage } from '../src/storage.js'
import { createBlock } from './fixtures/create-block.js'
import type { Pins } from '@helia/interface/pins'
import type { Blockstore } from 'interface-blockstore'
import type { CID } from 'multiformats/cid'

describe('storage', () => {
  let storage: BlockStorage
  let blockstore: Blockstore
  let pins: Pins
  let blocks: Array<{ cid: CID, block: Uint8Array }>

  beforeEach(async () => {
    blocks = []

    for (let i = 0; i < 10; i++) {
      blocks.push(await createBlock(raw.code, Uint8Array.from([0, 1, 2, i])))
    }

    const datastore = new MemoryDatastore()

    blockstore = new MemoryBlockstore()
    pins = new PinsImpl(datastore, blockstore, [])
    storage = new BlockStorage(blockstore, pins, {
      holdGcLock: true
    })
  })

  it('gets a block from the blockstore', async () => {
    const { cid, block } = blocks[0]
    await blockstore.put(cid, block)

    const retrieved = await storage.get(cid)
    expect(retrieved).to.equalBytes(block)
  })

  it('gets many blocks from the blockstore', async () => {
    const count = 5

    for (let i = 0; i < count; i++) {
      const { cid, block } = blocks[i]
      await blockstore.put(cid, block)
    }

    const retrieved = await all(storage.getMany(async function * () {
      for (let i = 0; i < count; i++) {
        yield blocks[i].cid
        await delay(10)
      }
    }()))

    expect(retrieved).to.deep.equal(new Array(count).fill(0).map((_, i) => blocks[i]))
  })

  it('puts a block into the blockstore', async () => {
    const { cid, block } = blocks[0]
    await storage.put(cid, block)

    const retrieved = await blockstore.get(cid)
    expect(retrieved).to.equalBytes(block)
  })

  it('puts many blocks into the blockstore', async () => {
    const count = 5

    await drain(storage.putMany(async function * () {
      for (let i = 0; i < count; i++) {
        yield { cid: blocks[i].cid, block: blocks[i].block }
        await delay(10)
      }
    }()))

    const retrieved = await all(blockstore.getMany(new Array(count).fill(0).map((_, i) => blocks[i].cid)))
    expect(retrieved).to.deep.equal(retrieved)
  })
})
