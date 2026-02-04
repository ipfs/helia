import { defaultLogger } from '@libp2p/logger'
import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import delay from 'delay'
import all from 'it-all'
import drain from 'it-drain'
import map from 'it-map'
import toBuffer from 'it-to-buffer'
import { CID } from 'multiformats/cid'
import * as raw from 'multiformats/codecs/raw'
import { identity } from 'multiformats/hashes/identity'
import { sha256, sha512 } from 'multiformats/hashes/sha2'
import Sinon from 'sinon'
import { stubInterface } from 'sinon-ts'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { getHasher } from '../../src/utils/get-hasher.js'
import { NetworkedStorage } from '../../src/utils/networked-storage.js'
import { getCidBlockVerifierFunction } from '../../src/utils/storage.ts'
import { createBlock } from '../fixtures/create-block.js'
import type { NetworkedStorageComponents } from '../../src/utils/networked-storage.js'
import type { BlockBroker } from '@helia/interface/blocks'
import type { Blockstore } from 'interface-blockstore'
import type { StubbedInstance } from 'sinon-ts'

describe('networked-storage', () => {
  let storage: NetworkedStorage
  let blockstore: Blockstore
  let bitswap: StubbedInstance<Required<BlockBroker>>
  let blocks: Array<{ cid: CID, block: Uint8Array }>
  let components: NetworkedStorageComponents

  beforeEach(async () => {
    blocks = []

    for (let i = 0; i < 10; i++) {
      blocks.push(await createBlock(raw.code, Uint8Array.from([0, 1, 2, i])))
    }

    blockstore = new MemoryBlockstore()
    bitswap = stubInterface()
    components = {
      blockstore,
      logger: defaultLogger(),
      blockBrokers: [
        bitswap
      ],
      getHasher: getHasher()
    }
    storage = new NetworkedStorage(components)
  })

  it('gets a block from the blockstore', async () => {
    const { cid, block } = blocks[0]
    await blockstore.put(cid, block)

    const retrieved = await toBuffer(storage.get(cid))
    expect(retrieved).to.equalBytes(block)
  })

  it('gets a block from the blockstore offline', async () => {
    const { cid } = blocks[0]

    await expect(drain(storage.get(cid, {
      offline: true
    }))).to.eventually.be.rejected.with.property('name', 'BlockNotFoundWhileOfflineError')
  })

  it('gets many blocks from the blockstore offline', async () => {
    const { cid } = blocks[0]

    await expect(drain(storage.getMany([cid], {
      offline: true
    }))).to.eventually.be.rejected.with.property('name', 'BlockNotFoundWhileOfflineError')
  })

  it('gets a block from the blockstore with progress', async () => {
    const { cid, block } = blocks[0]
    await blockstore.put(cid, block)

    const onProgress = Sinon.stub()

    await drain(storage.get(cid, {
      onProgress
    }))
    expect(onProgress.called).to.be.true()
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

  it('gets many blocks from the blockstore offline', async () => {
    const { cid } = blocks[0]

    await expect(drain(map(storage.getMany([cid], {
      offline: true
    }), async ({ cid, bytes }) => {
      return {
        cid,
        block: await toBuffer(bytes)
      }
    }))).to.eventually.be.rejected.with.property('name', 'BlockNotFoundWhileOfflineError')
  })

  it('puts a block into the blockstore', async () => {
    const { cid, block } = blocks[0]
    await storage.put(cid, block)

    const retrieved = await toBuffer(blockstore.get(cid))
    expect(retrieved).to.equalBytes(block)
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

  it('gets a block from bitswap when it is not in the blockstore', async () => {
    const { cid, block } = blocks[0]

    bitswap.retrieve.withArgs(cid).resolves(block)

    expect(await blockstore.has(cid)).to.be.false()

    const returned = await toBuffer(storage.get(cid))

    expect(await blockstore.has(cid)).to.be.true()
    expect(returned).to.equalBytes(block)
    expect(bitswap.retrieve.called).to.be.true()
  })

  it('gets many blocks from bitswap when they are not in the blockstore', async () => {
    const count = 5

    for (let i = 0; i < count; i++) {
      const { cid, block } = blocks[i]
      bitswap.retrieve.withArgs(cid).resolves(block)

      expect(await blockstore.has(cid)).to.be.false()
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

    for (let i = 0; i < count; i++) {
      const { cid } = blocks[i]
      expect(bitswap.retrieve.calledWith(cid)).to.be.true()
      expect(await blockstore.has(cid)).to.be.true()
    }
  })

  it('gets some blocks from bitswap when they are not in the blockstore', async () => {
    const count = 5

    // blocks 0,1,3,4 are in the blockstore
    await blockstore.put(blocks[0].cid, blocks[0].block)
    await blockstore.put(blocks[1].cid, blocks[1].block)
    await blockstore.put(blocks[3].cid, blocks[3].block)
    await blockstore.put(blocks[4].cid, blocks[4].block)

    // block #2 comes from bitswap but slowly
    bitswap.retrieve.withArgs(blocks[2].cid).callsFake(async () => {
      await delay(100)
      return blocks[2].block
    })

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

    for (let i = 0; i < count; i++) {
      expect(await blockstore.has(blocks[i].cid)).to.be.true()
    }
  })

  it('supports identity CIDs', async () => {
    const data = uint8ArrayFromString('hello world')
    const cid = CID.createV1(identity.code, identity.digest(data))

    const block = await toBuffer(storage.get(cid))
    expect(uint8ArrayToString(block)).to.equal('hello world')
  })

  it('cancels in-flight block requests when one resolves', async () => {
    const slowBroker = stubInterface<Required<BlockBroker>>()
    components.blockBrokers.push(slowBroker)

    bitswap.retrieve.withArgs(blocks[0].cid).resolves(blocks[0].block)

    const block = await toBuffer(storage.get(blocks[0].cid))

    expect(block).to.equalBytes(blocks[0].block)
    expect(slowBroker.retrieve.getCall(0)).to.have.nested.property('args[1].signal.aborted', true)
  })

  describe('block verifier', () => {
    it('should verify a block', async () => {
      const block = Uint8Array.from([0, 1, 2, 3, 4])
      const digest = await sha256.digest(block)
      const cid = CID.createV1(raw.code, digest)
      const fn = getCidBlockVerifierFunction(cid, sha256)

      // no promise rejection is a success
      await fn(block)
    })

    it('should verify a block with a truncated hash', async () => {
      const block = Uint8Array.from([0, 1, 2, 3, 4])
      const digest = await sha512.digest(block, {
        truncate: 32
      })
      const cid = CID.createV1(raw.code, digest)
      const fn = getCidBlockVerifierFunction(cid, sha512)

      // no promise rejection is a success
      await fn(block)
    })
  })
})
