import * as dagCbor from '@ipld/dag-cbor'
import * as dagJson from '@ipld/dag-json'
import * as dagPb from '@ipld/dag-pb'
import { expect } from 'aegir/chai'
import all from 'it-all'
import drain from 'it-drain'
import { CID } from 'multiformats/cid'
import * as json from 'multiformats/codecs/json'
import * as raw from 'multiformats/codecs/raw'
import { createAndPutBlock } from './fixtures/create-block.js'
import { createHelia } from './fixtures/create-helia.js'
import type { Helia } from '@helia/interface'
import type { ProgressEvent } from 'progress-events'

describe('pins', () => {
  let helia: Helia

  beforeEach(async () => {
    helia = await createHelia()
  })

  afterEach(async () => {
    if (helia != null) {
      await helia.stop()
    }
  })

  it('pins a block', async () => {
    const cidV1 = await createAndPutBlock(raw.code, Uint8Array.from([0, 1, 2, 3]), helia.blockstore)
    const cidV0 = CID.createV0(cidV1.multihash)

    await drain(helia.pins.add(cidV1))

    await expect(helia.pins.isPinned(cidV1)).to.eventually.be.true('did not pin v1 CID')
    await expect(helia.pins.isPinned(cidV0)).to.eventually.be.true('did not pin v0 CID')
  })

  it('gets a pin', async () => {
    const cid = await createAndPutBlock(raw.code, Uint8Array.from([0, 1, 2, 3]), helia.blockstore)

    await drain(helia.pins.add(cid))

    const pin = await helia.pins.get(cid)

    expect(pin).to.have.property('depth', Infinity)
    expect(pin).to.have.deep.property('metadata', {})
  })

  it('updates metadata for a pin', async () => {
    const cid = await createAndPutBlock(raw.code, Uint8Array.from([0, 1, 2, 3]), helia.blockstore)

    await drain(helia.pins.add(cid))

    const pin = await helia.pins.get(cid)

    expect(pin).to.have.deep.property('metadata', {})

    const newMetadata = {
      foo: 'bar',
      baz: true,
      qux: 5
    }

    await helia.pins.setMetadata(cid, newMetadata)

    const updatedPin = await helia.pins.get(cid)

    expect(updatedPin).to.have.deep.property('metadata', newMetadata)
  })

  it('pins a block with progress events', async () => {
    const cidV1 = await createAndPutBlock(raw.code, Uint8Array.from([0, 1, 2, 3]), helia.blockstore)

    const events: ProgressEvent[] = []

    await drain(helia.pins.add(cidV1, {
      onProgress: (evt) => {
        events.push(evt)
      }
    }))

    expect(events.map(e => e.type)).to.include.members([
      'blocks:get:blockstore:get',
      'helia:pin:add'
    ])
  })

  it('unpins a block', async () => {
    const cidV1 = await createAndPutBlock(raw.code, Uint8Array.from([0, 1, 2, 3]), helia.blockstore)
    const cidV0 = CID.createV0(cidV1.multihash)

    await drain(helia.pins.add(cidV1))

    await expect(helia.pins.isPinned(cidV1)).to.eventually.be.true('did not pin v1 CID')
    await expect(helia.pins.isPinned(cidV0)).to.eventually.be.true('did not pin v0 CID')

    await drain(helia.pins.rm(cidV1))

    await expect(helia.pins.isPinned(cidV1)).to.eventually.be.false('did not unpin v1 CID')
    await expect(helia.pins.isPinned(cidV0)).to.eventually.be.false('did not unpin v0 CID')
  })

  it('does not delete a pinned block', async () => {
    const cid = await createAndPutBlock(raw.code, Uint8Array.from([0, 1, 2, 3]), helia.blockstore)

    await drain(helia.pins.add(cid))

    await expect(helia.blockstore.delete(cid)).to.eventually.be.rejected
      .with.property('name', 'BlockPinnedError')
  })

  it('lists pins created with default args', async () => {
    const cidV1 = await createAndPutBlock(raw.code, Uint8Array.from([0, 1, 2, 3]), helia.blockstore)

    await drain(helia.pins.add(cidV1))

    const pins = await all(helia.pins.ls())

    expect(pins).to.have.lengthOf(1)
    expect(pins).to.have.nested.property('[0].cid').that.eql(cidV1)
    expect(pins).to.have.nested.property('[0].depth', Infinity)
    expect(pins).to.have.nested.property('[0].metadata').that.eql({})
  })

  it('lists pins with depth', async () => {
    const cidV1 = await createAndPutBlock(raw.code, Uint8Array.from([0, 1, 2, 3]), helia.blockstore)

    await drain(helia.pins.add(cidV1, {
      depth: 5
    }))

    const pins = await all(helia.pins.ls())

    expect(pins).to.have.lengthOf(1)
    expect(pins).to.have.nested.property('[0].cid').that.eql(cidV1)
    expect(pins).to.have.nested.property('[0].depth', 5)
  })

  it('lists pins with metadata', async () => {
    const cidV1 = await createAndPutBlock(raw.code, Uint8Array.from([0, 1, 2, 3]), helia.blockstore)
    const metadata = {
      foo: 'bar',
      baz: 5,
      qux: false
    }

    await drain(helia.pins.add(cidV1, {
      metadata
    }))

    const pins = await all(helia.pins.ls())

    expect(pins).to.have.lengthOf(1)
    expect(pins).to.have.nested.property('[0].cid').that.eql(cidV1)
    expect(pins).to.have.nested.property('[0].metadata').that.eql(metadata)
  })

  it('lists pins directly', async () => {
    const cid1 = await createAndPutBlock(raw.code, Uint8Array.from([0, 1, 2, 3]), helia.blockstore)
    const cid2 = await createAndPutBlock(raw.code, Uint8Array.from([4, 5, 6, 7]), helia.blockstore)

    await drain(helia.pins.add(cid1))
    await drain(helia.pins.add(cid2))

    const pins = await all(helia.pins.ls({
      cid: cid1
    }))

    expect(pins).to.have.lengthOf(1)
    expect(pins).to.have.nested.property('[0].cid').that.eql(cid1)
    expect(pins).to.have.nested.property('[0].depth', Infinity)
    expect(pins).to.have.nested.property('[0].metadata').that.eql({})
  })

  it('pins a json block', async () => {
    const cid1 = await createAndPutBlock(json.code, json.encode({ hello: 'world' }), helia.blockstore)

    await drain(helia.pins.add(cid1))

    const pins = await all(helia.pins.ls())

    expect(pins).to.have.lengthOf(1)
    expect(pins).to.have.nested.property('[0].cid').that.eql(cid1)
    expect(pins).to.have.nested.property('[0].depth', Infinity)
    expect(pins).to.have.nested.property('[0].metadata').that.eql({})
  })

  it('pins a dag-json block', async () => {
    const cid1 = await createAndPutBlock(dagJson.code, dagJson.encode({ hello: 'world' }), helia.blockstore)
    const cid2 = await createAndPutBlock(dagJson.code, dagJson.encode({ hello: 'world', linked: cid1 }), helia.blockstore)

    await drain(helia.pins.add(cid2))

    const pins = await all(helia.pins.ls())

    expect(pins).to.have.lengthOf(1)
    expect(pins).to.have.nested.property('[0].cid').that.eql(cid2)
    expect(pins).to.have.nested.property('[0].depth', Infinity)
    expect(pins).to.have.nested.property('[0].metadata').that.eql({})

    await expect(helia.pins.isPinned(cid1)).to.eventually.be.true()
    await expect(helia.pins.isPinned(cid2)).to.eventually.be.true()
  })

  it('pins a dag-cbor block', async () => {
    const cid1 = await createAndPutBlock(dagCbor.code, dagCbor.encode({ hello: 'world' }), helia.blockstore)
    const cid2 = await createAndPutBlock(dagCbor.code, dagCbor.encode({ hello: 'world', linked: cid1 }), helia.blockstore)

    await drain(helia.pins.add(cid2))

    const pins = await all(helia.pins.ls())

    expect(pins).to.have.lengthOf(1)
    expect(pins).to.have.nested.property('[0].cid').that.eql(cid2)
    expect(pins).to.have.nested.property('[0].depth', Infinity)
    expect(pins).to.have.nested.property('[0].metadata').that.eql({})

    await expect(helia.pins.isPinned(cid1)).to.eventually.be.true()
    await expect(helia.pins.isPinned(cid2)).to.eventually.be.true()
  })

  it('pins a dag-pb block', async () => {
    const cid1 = await createAndPutBlock(dagPb.code, dagPb.encode({ Data: Uint8Array.from([0, 1, 2, 3, 4]), Links: [] }), helia.blockstore)
    const cid2 = await createAndPutBlock(dagPb.code, dagPb.encode({ Links: [{ Name: '', Hash: cid1, Tsize: 100 }] }), helia.blockstore)

    await drain(helia.pins.add(cid2))

    const pins = await all(helia.pins.ls())

    expect(pins).to.have.lengthOf(1)
    expect(pins).to.have.nested.property('[0].cid').that.eql(cid2)
    expect(pins).to.have.nested.property('[0].depth', Infinity)
    expect(pins).to.have.nested.property('[0].metadata').that.eql({})

    await expect(helia.pins.isPinned(cid1)).to.eventually.be.true()
    await expect(helia.pins.isPinned(cid2)).to.eventually.be.true()
  })
})
