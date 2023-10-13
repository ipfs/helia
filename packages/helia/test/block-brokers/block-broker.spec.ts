/* eslint-env mocha */

import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import delay from 'delay'
import all from 'it-all'
import * as raw from 'multiformats/codecs/raw'
import Sinon from 'sinon'
import { type StubbedInstance, stubInterface } from 'sinon-ts'
import { defaultHashers } from '../../src/utils/default-hashers.js'
import { NetworkedStorage } from '../../src/utils/networked-storage.js'
import { createBlock } from '../fixtures/create-block.js'
import type { BitswapBlockBroker, TrustlessGatewayBlockBroker } from '../../src/block-brokers/index.js'
import type { Blockstore } from 'interface-blockstore'
import type { CID } from 'multiformats/cid'

describe('block-provider', () => {
  let storage: NetworkedStorage
  let blockstore: Blockstore
  let bitswapBlockBroker: StubbedInstance<BitswapBlockBroker>
  let blocks: Array<{ cid: CID, block: Uint8Array }>
  let gatewayBlockBroker: StubbedInstance<TrustlessGatewayBlockBroker>

  beforeEach(async () => {
    blocks = []

    for (let i = 0; i < 10; i++) {
      blocks.push(await createBlock(raw.code, Uint8Array.from([0, 1, 2, i])))
    }

    blockstore = new MemoryBlockstore()
    bitswapBlockBroker = stubInterface<BitswapBlockBroker>()
    gatewayBlockBroker = stubInterface<TrustlessGatewayBlockBroker>()
    storage = new NetworkedStorage(blockstore, {
      blockBrokers: [
        bitswapBlockBroker,
        gatewayBlockBroker
      ],
      hashers: defaultHashers()
    })
  })

  it('gets a block from the gatewayBlockBroker when it is not in the blockstore', async () => {
    const { cid, block } = blocks[0]

    gatewayBlockBroker.retrieve.withArgs(cid, Sinon.match.any).resolves(block)

    expect(await blockstore.has(cid)).to.be.false()

    const returned = await storage.get(cid)

    expect(await blockstore.has(cid)).to.be.true()
    expect(returned).to.equalBytes(block)
    expect(gatewayBlockBroker.retrieve.calledWith(cid)).to.be.true()
  })

  it('gets many blocks from gatewayBlockBroker when they are not in the blockstore', async () => {
    const count = 5

    for (let i = 0; i < count; i++) {
      const { cid, block } = blocks[i]
      gatewayBlockBroker.retrieve.withArgs(cid, Sinon.match.any).resolves(block)

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
      expect(gatewayBlockBroker.retrieve.calledWith(cid)).to.be.true()
      expect(await blockstore.has(cid)).to.be.true()
    }
  })

  it('gets some blocks from gatewayBlockBroker when they are not in the blockstore', async () => {
    const count = 5

    // blocks 0,1,3,4 are in the blockstore
    await blockstore.put(blocks[0].cid, blocks[0].block)
    await blockstore.put(blocks[1].cid, blocks[1].block)
    await blockstore.put(blocks[3].cid, blocks[3].block)
    await blockstore.put(blocks[4].cid, blocks[4].block)

    // block #2 comes from gatewayBlockBroker but slowly
    gatewayBlockBroker.retrieve.withArgs(blocks[2].cid).callsFake(async () => {
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

  it('handles incorrect bytes from a gateway', async () => {
    const { cid } = blocks[0]
    const block = blocks[1].block
    storage = new NetworkedStorage(blockstore, {
      blockBrokers: [
        gatewayBlockBroker
      ],
      hashers: defaultHashers()
    })

    gatewayBlockBroker.retrieve.withArgs(cid, Sinon.match.any).resolves(block)

    expect(await blockstore.has(cid)).to.be.false()

    try {
      await storage.get(cid)
      throw new Error('should have thrown')
    } catch (err) {
      const error = err as AggregateError & { errors: Error & { code: string } }
      expect(error).to.be.an('error')
      expect(error.errors).to.be.an('array').with.lengthOf(1)
      expect(error.errors[0]).to.be.an('error').with.property('code', 'ERR_HASH_MISMATCH')
    }
  })
})
