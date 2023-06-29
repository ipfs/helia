/* eslint-env mocha */
import type { Helia } from '@helia/interface'
import type { Pins } from '@helia/interface/pins'
import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import delay from 'delay'
import type { Blockstore, Pair } from 'interface-blockstore'
import type { Bitswap } from 'ipfs-bitswap'
import all from 'it-all'
import drain from 'it-drain'
import type { CID } from 'multiformats/cid'
import * as raw from 'multiformats/codecs/raw'
import * as Sinon from 'sinon'
import { stubInterface, type StubbedInstance } from 'sinon-ts'
import { createHelia } from '../src/index.js'
import { PinsImpl } from '../src/pins.js'
import { BlockStorage } from '../src/storage.js'
import { createBlock } from './fixtures/create-block.js'

describe('storage', () => {
  let storage: BlockStorage
  let blockstore: Blockstore
  let bitswap: StubbedInstance<Bitswap>
  let pins: Pins
  let blocks: Array<{ cid: CID, block: Uint8Array }>

  beforeEach(async () => {
    blocks = []

    for (let i = 0; i < 10; i++) {
      blocks.push(await createBlock(raw.code, Uint8Array.from([0, 1, 2, i])))
    }

    const datastore = new MemoryDatastore()

    blockstore = new MemoryBlockstore()
    bitswap = stubInterface<Bitswap>()
    pins = new PinsImpl(datastore, blockstore, [])
    storage = new BlockStorage(blockstore, pins, {
      bitswap,
      holdGcLock: true
    })
  })

  it('gets a block from the blockstore', async () => {
    const { cid, block } = blocks[0]
    await blockstore.put(cid, block)

    const retrieved = await storage.get(cid)
    expect(retrieved).to.equalBytes(block)
  })

  it('gets a block from the blockstore with progress', async () => {
    const { cid, block } = blocks[0]
    await blockstore.put(cid, block)

    const onProgress = Sinon.stub()

    await storage.get(cid, {
      onProgress
    })
    expect(onProgress.called).to.be.true()
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

  it('gets a block from bitswap when it is not in the blockstore', async () => {
    const { cid, block } = blocks[0]

    bitswap.isStarted.returns(true)
    bitswap.want.withArgs(cid).resolves(block)

    expect(await blockstore.has(cid)).to.be.false()

    const returned = await storage.get(cid)

    expect(await blockstore.has(cid)).to.be.true()
    expect(returned).to.equalBytes(block)
    expect(bitswap.want.called).to.be.true()
  })

  it('gets many blocks from bitswap when they are not in the blockstore', async () => {
    bitswap.isStarted.returns(true)

    const count = 5

    for (let i = 0; i < count; i++) {
      const { cid, block } = blocks[i]
      bitswap.want.withArgs(cid).resolves(block)

      expect(await blockstore.has(cid)).to.be.false()
    }

    const retrieved = await all(storage.getMany(async function * () {
      for (let i = 0; i < count; i++) {
        yield blocks[i].cid
        await delay(10)
      }
    }()))

    expect(retrieved).to.deep.equal(new Array(count).fill(0).map((_, i) => blocks[i]))

    for (let i = 0; i < count; i++) {
      const { cid } = blocks[i]
      expect(bitswap.want.calledWith(cid)).to.be.true()
      expect(await blockstore.has(cid)).to.be.true()
    }
  })

  it('gets some blocks from bitswap when they are not in the blockstore', async () => {
    bitswap.isStarted.returns(true)

    const count = 5

    // blocks 0,1,3,4 are in the blockstore
    await blockstore.put(blocks[0].cid, blocks[0].block)
    await blockstore.put(blocks[1].cid, blocks[1].block)
    await blockstore.put(blocks[3].cid, blocks[3].block)
    await blockstore.put(blocks[4].cid, blocks[4].block)

    // block #2 comes from bitswap but slowly
    bitswap.want.withArgs(blocks[2].cid).callsFake(async () => {
      await delay(100)
      return blocks[2].block
    })

    const retrieved = await all(storage.getMany(async function * () {
      for (let i = 0; i < count; i++) {
        yield blocks[i].cid
        await delay(10)
      }
    }()))

    expect(retrieved).to.deep.equal(new Array(count).fill(0).map((_, i) => blocks[i]))

    for (let i = 0; i < count; i++) {
      expect(await blockstore.has(blocks[i].cid)).to.be.true()
    }
  })

  describe('blocking stores', () => {
    let helia: Helia

    beforeEach(async () => {
      helia = await createHelia({
        blockstore
      })
    })

    afterEach(async () => {
      if (helia != null) {
        await helia.stop()
      }
    })

    it.only('gets many blocks from bitswap when they are not in the blockstore and does not block.', async () => {
      bitswap.isStarted.returns(true)

      const count = 5

      for (let i = 0; i < count; i++) {
        const { cid, block } = blocks[i]
        bitswap.want.withArgs(cid).resolves(block)

        expect(await blockstore.has(cid)).to.be.false()
      }

      const cidsGenerator = async function* (): AsyncGenerator<CID> {
        for (let i = 0; i < count; i++) {
          yield blocks[i].cid
          await delay(10)
        }
      }

      const getFirstEntry = async (asyncIterableInstance: AsyncIterable<Pair>) => {
        for await (const entry of asyncIterableInstance) {
          await helia.gc({ signal: AbortSignal.timeout(100) })
          return entry;
        }
      }

      setTimeout(() => Promise.reject(), 10000)
      const retrieved = await storage.getMany(cidsGenerator())
      const firstEntryFromRetrieved = await getFirstEntry(retrieved)
      expect(firstEntryFromRetrieved?.block).to.not.be.undefined()
    })
  })
})
