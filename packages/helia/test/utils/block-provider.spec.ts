/* eslint-env mocha */

import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import delay from 'delay'
import all from 'it-all'
import * as raw from 'multiformats/codecs/raw'
import Sinon from 'sinon'
import { type StubbedInstance, stubInterface } from 'sinon-ts'
import { NetworkedStorage } from '../../src/utils/networked-storage.js'
import { createBlock } from '../fixtures/create-block.js'
import type { Blockstore } from 'interface-blockstore'
import type { Bitswap } from 'ipfs-bitswap'
import type { CID } from 'multiformats/cid'
import { BlockProvider } from '../../src/utils/block-provider.js'

describe('block-provider', () => {
  let storage: NetworkedStorage
  let blockstore: Blockstore
  let bitswap: StubbedInstance<Bitswap>
  let blockProvider: StubbedInstance<BlockProvider>
  let blocks: Array<{ cid: CID, block: Uint8Array }>

  beforeEach(async () => {
    blocks = []

    for (let i = 0; i < 10; i++) {
      blocks.push(await createBlock(raw.code, Uint8Array.from([0, 1, 2, i])))
    }

    blockstore = new MemoryBlockstore()
    bitswap = stubInterface<Bitswap>()
    blockProvider = stubInterface<BlockProvider>()
    storage = new NetworkedStorage(blockstore, {
      bitswap,
      blockProviders: [blockProvider]
    })
    // disable bitswap
    bitswap.isStarted.returns(false)
  })

  it('gets a block from the blockProvider when it is not in the blockstore', async () => {
    const { cid, block } = blocks[0]

    blockProvider.get.withArgs(cid, Sinon.match.any).resolves(block)

    expect(await blockstore.has(cid)).to.be.false()

    const returned = await storage.get(cid)

    expect(await blockstore.has(cid)).to.be.true()
    expect(returned).to.equalBytes(block)
    expect(blockProvider.get.calledWith(cid)).to.be.true()
  })

  it('gets many blocks from blockProvider when they are not in the blockstore', async () => {
    const count = 5

    for (let i = 0; i < count; i++) {
      const { cid, block } = blocks[i]
      blockProvider.get.withArgs(cid, Sinon.match.any).resolves(block)

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
      expect(blockProvider.get.calledWith(cid)).to.be.true()
      expect(await blockstore.has(cid)).to.be.true()
    }
  })

  it('gets some blocks from blockProvider when they are not in the blockstore', async () => {
    const count = 5

    // blocks 0,1,3,4 are in the blockstore
    await blockstore.put(blocks[0].cid, blocks[0].block)
    await blockstore.put(blocks[1].cid, blocks[1].block)
    await blockstore.put(blocks[3].cid, blocks[3].block)
    await blockstore.put(blocks[4].cid, blocks[4].block)

    // block #2 comes from blockProvider but slowly
    blockProvider.get.withArgs(blocks[2].cid).callsFake(async () => {
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
})
