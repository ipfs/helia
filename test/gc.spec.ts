/* eslint-env mocha */

import * as dagCbor from '@ipld/dag-cbor'
import * as dagJson from '@ipld/dag-json'
import * as dagPb from '@ipld/dag-pb'
import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import * as raw from 'multiformats/codecs/raw'
import { createHeliaHTTP } from '../src/index.js'
import { createAndPutBlock } from './fixtures/create-block.js'
import type { GcEvents } from '@helia/interface'
import type { HeliaHTTP } from '@helia/interface/http'

describe('gc', () => {
  let heliaHTTP: HeliaHTTP

  beforeEach(async () => {
    heliaHTTP = await createHeliaHTTP({
      datastore: new MemoryDatastore(),
      blockstore: new MemoryBlockstore()
    })
  })

  afterEach(async () => {
    if (heliaHTTP != null) {
      await heliaHTTP.stop()
    }
  })

  it('pins a dag-pb node and does not garbage collect it or its children', async () => {
    const child1 = await createAndPutBlock(dagPb.code, dagPb.encode({
      Data: Uint8Array.from([0, 1, 2, 3]),
      Links: []
    }), heliaHTTP.blockstore)
    const child2 = await createAndPutBlock(dagPb.code, dagPb.encode({
      Data: Uint8Array.from([4, 5, 6, 7]),
      Links: []
    }), heliaHTTP.blockstore)

    const node = await createAndPutBlock(dagPb.code, dagPb.encode({
      Links: [{
        Hash: child1,
        Name: 'child1'
      }, {
        Hash: child2,
        Name: 'child2'
      }]
    }), heliaHTTP.blockstore)

    await heliaHTTP.pins.add(node)

    // this block will be garbage collected
    const doomed = await createAndPutBlock(dagPb.code, dagPb.encode({
      Data: Uint8Array.from([8, 9, 0, 1]),
      Links: []
    }), heliaHTTP.blockstore)

    await expect(heliaHTTP.blockstore.has(child1)).to.eventually.be.true()
    await expect(heliaHTTP.blockstore.has(child2)).to.eventually.be.true()
    await expect(heliaHTTP.blockstore.has(node)).to.eventually.be.true()
    await expect(heliaHTTP.blockstore.has(doomed)).to.eventually.be.true()

    await heliaHTTP.gc()

    await expect(heliaHTTP.blockstore.has(child1)).to.eventually.be.true()
    await expect(heliaHTTP.blockstore.has(child2)).to.eventually.be.true()
    await expect(heliaHTTP.blockstore.has(node)).to.eventually.be.true()
    await expect(heliaHTTP.blockstore.has(doomed)).to.eventually.be.false()
  })

  it('pins a dag-cbor node and does not garbage collect it or its children', async () => {
    const child1 = await createAndPutBlock(dagCbor.code, dagCbor.encode({
      foo: 'bar'
    }), heliaHTTP.blockstore)
    const child2 = await createAndPutBlock(dagCbor.code, dagCbor.encode({
      baz: 'qux'
    }), heliaHTTP.blockstore)

    const node = await createAndPutBlock(dagCbor.code, dagCbor.encode({
      children: [
        child1,
        child2
      ]
    }), heliaHTTP.blockstore)

    await heliaHTTP.pins.add(node)

    // this block will be garbage collected
    const doomed = await createAndPutBlock(dagCbor.code, dagJson.encode({
      quux: 'garply'
    }), heliaHTTP.blockstore)

    await expect(heliaHTTP.blockstore.has(child1)).to.eventually.be.true()
    await expect(heliaHTTP.blockstore.has(child2)).to.eventually.be.true()
    await expect(heliaHTTP.blockstore.has(node)).to.eventually.be.true()
    await expect(heliaHTTP.blockstore.has(doomed)).to.eventually.be.true()

    await heliaHTTP.gc()

    await expect(heliaHTTP.blockstore.has(child1)).to.eventually.be.true()
    await expect(heliaHTTP.blockstore.has(child2)).to.eventually.be.true()
    await expect(heliaHTTP.blockstore.has(node)).to.eventually.be.true()
    await expect(heliaHTTP.blockstore.has(doomed)).to.eventually.be.false()
  })

  it('pins a dag-json node and does not garbage collect it or its children', async () => {
    const child1 = await createAndPutBlock(dagJson.code, dagJson.encode({
      foo: 'bar'
    }), heliaHTTP.blockstore)
    const child2 = await createAndPutBlock(dagJson.code, dagJson.encode({
      baz: 'qux'
    }), heliaHTTP.blockstore)

    const node = await createAndPutBlock(dagJson.code, dagJson.encode({
      children: [
        child1,
        child2
      ]
    }), heliaHTTP.blockstore)

    await heliaHTTP.pins.add(node)

    // this block will be garbage collected
    const doomed = await createAndPutBlock(dagJson.code, dagJson.encode({
      quux: 'garply'
    }), heliaHTTP.blockstore)

    await expect(heliaHTTP.blockstore.has(child1)).to.eventually.be.true()
    await expect(heliaHTTP.blockstore.has(child2)).to.eventually.be.true()
    await expect(heliaHTTP.blockstore.has(node)).to.eventually.be.true()
    await expect(heliaHTTP.blockstore.has(doomed)).to.eventually.be.true()

    await heliaHTTP.gc()

    await expect(heliaHTTP.blockstore.has(child1)).to.eventually.be.true()
    await expect(heliaHTTP.blockstore.has(child2)).to.eventually.be.true()
    await expect(heliaHTTP.blockstore.has(node)).to.eventually.be.true()
    await expect(heliaHTTP.blockstore.has(doomed)).to.eventually.be.false()
  })

  it('pins a raw node and does not garbage collect it', async () => {
    const cid = await createAndPutBlock(raw.code, Uint8Array.from([0, 1, 2, 3]), heliaHTTP.blockstore)

    await heliaHTTP.pins.add(cid)

    // this block will be garbage collected
    const doomed = await createAndPutBlock(raw.code, Uint8Array.from([4, 5, 6, 7]), heliaHTTP.blockstore)

    await expect(heliaHTTP.blockstore.has(cid)).to.eventually.be.true()
    await expect(heliaHTTP.blockstore.has(doomed)).to.eventually.be.true()

    await heliaHTTP.gc()

    await expect(heliaHTTP.blockstore.has(cid)).to.eventually.be.true()
    await expect(heliaHTTP.blockstore.has(doomed)).to.eventually.be.false()
  })

  it('can garbage collect around a CID that causes an error', async () => {
    const cid = await createAndPutBlock(0x10, Uint8Array.from([0, 1, 2, 3]), heliaHTTP.blockstore)

    await expect(heliaHTTP.blockstore.has(cid)).to.eventually.be.true('did not have cid')

    const events: GcEvents[] = []

    // make the datastore break in some way
    heliaHTTP.datastore.has = async () => {
      throw new Error('Urk!')
    }

    await heliaHTTP.gc({
      onProgress: (evt) => {
        events.push(evt)
      }
    })

    await expect(heliaHTTP.blockstore.has(cid)).to.eventually.be.true('did not keep cid')

    const errorEvents = events.filter(e => e.type === 'helia:gc:error')
    expect(errorEvents).to.have.lengthOf(1)
    expect(errorEvents[0].detail.toString()).to.include('Urk!')
  })
})
