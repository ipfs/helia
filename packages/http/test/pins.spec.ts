/* eslint-env mocha */

import * as dagCbor from '@ipld/dag-cbor'
import * as dagJson from '@ipld/dag-json'
import * as dagPb from '@ipld/dag-pb'
import { expect } from 'aegir/chai'
import all from 'it-all'
import { CID } from 'multiformats/cid'
import * as json from 'multiformats/codecs/json'
import * as raw from 'multiformats/codecs/raw'
import { createAndPutBlock } from './fixtures/create-block.js'
import { createHeliaHTTP } from './fixtures/create-helia-http.js'
import type { HeliaHTTP } from '@helia/interface/http'
import type { ProgressEvent } from 'progress-events'

describe('pins', () => {
  let heliaHTTP: HeliaHTTP

  beforeEach(async () => {
    heliaHTTP = await createHeliaHTTP()
  })

  afterEach(async () => {
    if (heliaHTTP != null) {
      await heliaHTTP.stop()
    }
  })

  it('pins a block', async () => {
    const cidV1 = await createAndPutBlock(raw.code, Uint8Array.from([0, 1, 2, 3]), heliaHTTP.blockstore)
    const cidV0 = CID.createV0(cidV1.multihash)

    await heliaHTTP.pins.add(cidV1)

    await expect(heliaHTTP.pins.isPinned(cidV1)).to.eventually.be.true('did not pin v1 CID')
    await expect(heliaHTTP.pins.isPinned(cidV0)).to.eventually.be.true('did not pin v0 CID')
  })

  it('pins a block with progress events', async () => {
    const cidV1 = await createAndPutBlock(raw.code, Uint8Array.from([0, 1, 2, 3]), heliaHTTP.blockstore)

    const events: ProgressEvent[] = []

    await heliaHTTP.pins.add(cidV1, {
      onProgress: (evt) => {
        events.push(evt)
      }
    })

    expect(events.map(e => e.type)).to.include.members([
      'blocks:get:blockstore:get',
      'helia:pin:add'
    ])
  })

  it('unpins a block', async () => {
    const cidV1 = await createAndPutBlock(raw.code, Uint8Array.from([0, 1, 2, 3]), heliaHTTP.blockstore)
    const cidV0 = CID.createV0(cidV1.multihash)

    await heliaHTTP.pins.add(cidV1)

    await expect(heliaHTTP.pins.isPinned(cidV1)).to.eventually.be.true('did not pin v1 CID')
    await expect(heliaHTTP.pins.isPinned(cidV0)).to.eventually.be.true('did not pin v0 CID')

    await heliaHTTP.pins.rm(cidV1)

    await expect(heliaHTTP.pins.isPinned(cidV1)).to.eventually.be.false('did not unpin v1 CID')
    await expect(heliaHTTP.pins.isPinned(cidV0)).to.eventually.be.false('did not unpin v0 CID')
  })

  it('does not delete a pinned block', async () => {
    const cid = await createAndPutBlock(raw.code, Uint8Array.from([0, 1, 2, 3]), heliaHTTP.blockstore)

    await heliaHTTP.pins.add(cid)

    await expect(heliaHTTP.blockstore.delete(cid)).to.eventually.be.rejected
      .with.property('message', 'CID was pinned')
  })

  it('lists pins created with default args', async () => {
    const cidV1 = await createAndPutBlock(raw.code, Uint8Array.from([0, 1, 2, 3]), heliaHTTP.blockstore)

    await heliaHTTP.pins.add(cidV1)

    const pins = await all(heliaHTTP.pins.ls())

    expect(pins).to.have.lengthOf(1)
    expect(pins).to.have.nested.property('[0].cid').that.eql(cidV1)
    expect(pins).to.have.nested.property('[0].depth', Infinity)
    expect(pins).to.have.nested.property('[0].metadata').that.eql({})
  })

  it('lists pins with depth', async () => {
    const cidV1 = await createAndPutBlock(raw.code, Uint8Array.from([0, 1, 2, 3]), heliaHTTP.blockstore)

    await heliaHTTP.pins.add(cidV1, {
      depth: 5
    })

    const pins = await all(heliaHTTP.pins.ls())

    expect(pins).to.have.lengthOf(1)
    expect(pins).to.have.nested.property('[0].cid').that.eql(cidV1)
    expect(pins).to.have.nested.property('[0].depth', 5)
  })

  it('lists pins with metadata', async () => {
    const cidV1 = await createAndPutBlock(raw.code, Uint8Array.from([0, 1, 2, 3]), heliaHTTP.blockstore)
    const metadata = {
      foo: 'bar',
      baz: 5,
      qux: false
    }

    await heliaHTTP.pins.add(cidV1, {
      metadata
    })

    const pins = await all(heliaHTTP.pins.ls())

    expect(pins).to.have.lengthOf(1)
    expect(pins).to.have.nested.property('[0].cid').that.eql(cidV1)
    expect(pins).to.have.nested.property('[0].metadata').that.eql(metadata)
  })

  it('lists pins directly', async () => {
    const cid1 = await createAndPutBlock(raw.code, Uint8Array.from([0, 1, 2, 3]), heliaHTTP.blockstore)
    const cid2 = await createAndPutBlock(raw.code, Uint8Array.from([4, 5, 6, 7]), heliaHTTP.blockstore)

    await heliaHTTP.pins.add(cid1)
    await heliaHTTP.pins.add(cid2)

    const pins = await all(heliaHTTP.pins.ls({
      cid: cid1
    }))

    expect(pins).to.have.lengthOf(1)
    expect(pins).to.have.nested.property('[0].cid').that.eql(cid1)
    expect(pins).to.have.nested.property('[0].depth', Infinity)
    expect(pins).to.have.nested.property('[0].metadata').that.eql({})
  })

  it('pins a json block', async () => {
    const cid1 = await createAndPutBlock(json.code, json.encode({ hello: 'world' }), heliaHTTP.blockstore)

    await heliaHTTP.pins.add(cid1)

    const pins = await all(heliaHTTP.pins.ls())

    expect(pins).to.have.lengthOf(1)
    expect(pins).to.have.nested.property('[0].cid').that.eql(cid1)
    expect(pins).to.have.nested.property('[0].depth', Infinity)
    expect(pins).to.have.nested.property('[0].metadata').that.eql({})
  })

  it('pins a dag-json block', async () => {
    const cid1 = await createAndPutBlock(dagJson.code, dagJson.encode({ hello: 'world' }), heliaHTTP.blockstore)
    const cid2 = await createAndPutBlock(dagJson.code, dagJson.encode({ hello: 'world', linked: cid1 }), heliaHTTP.blockstore)

    await heliaHTTP.pins.add(cid2)

    const pins = await all(heliaHTTP.pins.ls())

    expect(pins).to.have.lengthOf(1)
    expect(pins).to.have.nested.property('[0].cid').that.eql(cid2)
    expect(pins).to.have.nested.property('[0].depth', Infinity)
    expect(pins).to.have.nested.property('[0].metadata').that.eql({})

    await expect(heliaHTTP.pins.isPinned(cid1)).to.eventually.be.true()
    await expect(heliaHTTP.pins.isPinned(cid2)).to.eventually.be.true()
  })

  it('pins a dag-cbor block', async () => {
    const cid1 = await createAndPutBlock(dagCbor.code, dagCbor.encode({ hello: 'world' }), heliaHTTP.blockstore)
    const cid2 = await createAndPutBlock(dagCbor.code, dagCbor.encode({ hello: 'world', linked: cid1 }), heliaHTTP.blockstore)

    await heliaHTTP.pins.add(cid2)

    const pins = await all(heliaHTTP.pins.ls())

    expect(pins).to.have.lengthOf(1)
    expect(pins).to.have.nested.property('[0].cid').that.eql(cid2)
    expect(pins).to.have.nested.property('[0].depth', Infinity)
    expect(pins).to.have.nested.property('[0].metadata').that.eql({})

    await expect(heliaHTTP.pins.isPinned(cid1)).to.eventually.be.true()
    await expect(heliaHTTP.pins.isPinned(cid2)).to.eventually.be.true()
  })

  it('pins a dag-pb block', async () => {
    const cid1 = await createAndPutBlock(dagPb.code, dagPb.encode({ Data: Uint8Array.from([0, 1, 2, 3, 4]), Links: [] }), heliaHTTP.blockstore)
    const cid2 = await createAndPutBlock(dagPb.code, dagPb.encode({ Links: [{ Name: '', Hash: cid1, Tsize: 100 }] }), heliaHTTP.blockstore)

    await heliaHTTP.pins.add(cid2)

    const pins = await all(heliaHTTP.pins.ls())

    expect(pins).to.have.lengthOf(1)
    expect(pins).to.have.nested.property('[0].cid').that.eql(cid2)
    expect(pins).to.have.nested.property('[0].depth', Infinity)
    expect(pins).to.have.nested.property('[0].metadata').that.eql({})

    await expect(heliaHTTP.pins.isPinned(cid1)).to.eventually.be.true()
    await expect(heliaHTTP.pins.isPinned(cid2)).to.eventually.be.true()
  })
})
