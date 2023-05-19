/* eslint-env mocha */

import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import * as dagCbor from '@ipld/dag-cbor'
import * as dagJson from '@ipld/dag-json'
import * as dagPb from '@ipld/dag-pb'
import { webSockets } from '@libp2p/websockets'
import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { createLibp2p } from 'libp2p'
import * as raw from 'multiformats/codecs/raw'
import { createHelia } from '../src/index.js'
import { createAndPutBlock } from './fixtures/create-block.js'
import type { GcEvents, Helia } from '@helia/interface'

describe('gc', () => {
  let helia: Helia

  beforeEach(async () => {
    helia = await createHelia({
      datastore: new MemoryDatastore(),
      blockstore: new MemoryBlockstore(),
      libp2p: await createLibp2p({
        transports: [
          webSockets()
        ],
        connectionEncryption: [
          noise()
        ],
        streamMuxers: [
          yamux()
        ]
      })
    })
  })

  afterEach(async () => {
    if (helia != null) {
      await helia.stop()
    }
  })

  it('pins a dag-pb node and does not garbage collect it or its children', async () => {
    const child1 = await createAndPutBlock(dagPb.code, dagPb.encode({
      Data: Uint8Array.from([0, 1, 2, 3]),
      Links: []
    }), helia.blockstore)
    const child2 = await createAndPutBlock(dagPb.code, dagPb.encode({
      Data: Uint8Array.from([4, 5, 6, 7]),
      Links: []
    }), helia.blockstore)

    const node = await createAndPutBlock(dagPb.code, dagPb.encode({
      Links: [{
        Hash: child1,
        Name: 'child1'
      }, {
        Hash: child2,
        Name: 'child2'
      }]
    }), helia.blockstore)

    await helia.pins.add(node)

    // this block will be garbage collected
    const doomed = await createAndPutBlock(dagPb.code, dagPb.encode({
      Data: Uint8Array.from([8, 9, 0, 1]),
      Links: []
    }), helia.blockstore)

    await expect(helia.blockstore.has(child1)).to.eventually.be.true()
    await expect(helia.blockstore.has(child2)).to.eventually.be.true()
    await expect(helia.blockstore.has(node)).to.eventually.be.true()
    await expect(helia.blockstore.has(doomed)).to.eventually.be.true()

    await helia.gc()

    await expect(helia.blockstore.has(child1)).to.eventually.be.true()
    await expect(helia.blockstore.has(child2)).to.eventually.be.true()
    await expect(helia.blockstore.has(node)).to.eventually.be.true()
    await expect(helia.blockstore.has(doomed)).to.eventually.be.false()
  })

  it('pins a dag-cbor node and does not garbage collect it or its children', async () => {
    const child1 = await createAndPutBlock(dagCbor.code, dagCbor.encode({
      foo: 'bar'
    }), helia.blockstore)
    const child2 = await createAndPutBlock(dagCbor.code, dagCbor.encode({
      baz: 'qux'
    }), helia.blockstore)

    const node = await createAndPutBlock(dagCbor.code, dagCbor.encode({
      children: [
        child1,
        child2
      ]
    }), helia.blockstore)

    await helia.pins.add(node)

    // this block will be garbage collected
    const doomed = await createAndPutBlock(dagCbor.code, dagJson.encode({
      quux: 'garply'
    }), helia.blockstore)

    await expect(helia.blockstore.has(child1)).to.eventually.be.true()
    await expect(helia.blockstore.has(child2)).to.eventually.be.true()
    await expect(helia.blockstore.has(node)).to.eventually.be.true()
    await expect(helia.blockstore.has(doomed)).to.eventually.be.true()

    await helia.gc()

    await expect(helia.blockstore.has(child1)).to.eventually.be.true()
    await expect(helia.blockstore.has(child2)).to.eventually.be.true()
    await expect(helia.blockstore.has(node)).to.eventually.be.true()
    await expect(helia.blockstore.has(doomed)).to.eventually.be.false()
  })

  it('pins a dag-json node and does not garbage collect it or its children', async () => {
    const child1 = await createAndPutBlock(dagJson.code, dagJson.encode({
      foo: 'bar'
    }), helia.blockstore)
    const child2 = await createAndPutBlock(dagJson.code, dagJson.encode({
      baz: 'qux'
    }), helia.blockstore)

    const node = await createAndPutBlock(dagJson.code, dagJson.encode({
      children: [
        child1,
        child2
      ]
    }), helia.blockstore)

    await helia.pins.add(node)

    // this block will be garbage collected
    const doomed = await createAndPutBlock(dagJson.code, dagJson.encode({
      quux: 'garply'
    }), helia.blockstore)

    await expect(helia.blockstore.has(child1)).to.eventually.be.true()
    await expect(helia.blockstore.has(child2)).to.eventually.be.true()
    await expect(helia.blockstore.has(node)).to.eventually.be.true()
    await expect(helia.blockstore.has(doomed)).to.eventually.be.true()

    await helia.gc()

    await expect(helia.blockstore.has(child1)).to.eventually.be.true()
    await expect(helia.blockstore.has(child2)).to.eventually.be.true()
    await expect(helia.blockstore.has(node)).to.eventually.be.true()
    await expect(helia.blockstore.has(doomed)).to.eventually.be.false()
  })

  it('pins a raw node and does not garbage collect it', async () => {
    const cid = await createAndPutBlock(raw.code, Uint8Array.from([0, 1, 2, 3]), helia.blockstore)

    await helia.pins.add(cid)

    // this block will be garbage collected
    const doomed = await createAndPutBlock(raw.code, Uint8Array.from([4, 5, 6, 7]), helia.blockstore)

    await expect(helia.blockstore.has(cid)).to.eventually.be.true()
    await expect(helia.blockstore.has(doomed)).to.eventually.be.true()

    await helia.gc()

    await expect(helia.blockstore.has(cid)).to.eventually.be.true()
    await expect(helia.blockstore.has(doomed)).to.eventually.be.false()
  })

  it('can garbage collect around a CID that causes an error', async () => {
    const cid = await createAndPutBlock(0x10, Uint8Array.from([0, 1, 2, 3]), helia.blockstore)

    await expect(helia.blockstore.has(cid)).to.eventually.be.true('did not have cid')

    const events: GcEvents[] = []

    // make the datastore break in some way
    helia.datastore.has = async () => {
      throw new Error('Urk!')
    }

    await helia.gc({
      onProgress: (evt) => {
        events.push(evt)
      }
    })

    await expect(helia.blockstore.has(cid)).to.eventually.be.true('did not keep cid')

    const errorEvents = events.filter(e => e.type === 'helia:gc:error')
    expect(errorEvents).to.have.lengthOf(1)
    expect(errorEvents[0].detail.toString()).to.include('Urk!')
  })
})
