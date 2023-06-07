/* eslint-env mocha */

import { expect } from 'aegir/chai'
import all from 'it-all'
import { CID } from 'multiformats/cid'
import * as raw from 'multiformats/codecs/raw'
import { createAndPutBlock } from './fixtures/create-block.js'
import { createHelia } from './fixtures/create-helia.js'
import type { Helia } from '@helia/interface'
import type { ProgressEvent } from 'progress-events'

describe('pins', () => {
  let helia: Helia
  let remote: Helia

  beforeEach(async () => {
    helia = await createHelia()
    remote = await createHelia()
  })

  afterEach(async () => {
    if (helia != null) {
      await helia.stop()
    }

    if (remote != null) {
      await remote.stop()
    }
  })

  it('pins a block', async () => {
    const cidV1 = await createAndPutBlock(raw.code, Uint8Array.from([0, 1, 2, 3]), helia.blockstore)
    const cidV0 = CID.createV0(cidV1.multihash)

    await helia.pins.add(cidV1)

    await expect(helia.pins.isPinned(cidV1)).to.eventually.be.true('did not pin v1 CID')
    await expect(helia.pins.isPinned(cidV0)).to.eventually.be.true('did not pin v0 CID')
  })

  it('pins a block with progress events', async () => {
    const cidV1 = await createAndPutBlock(raw.code, Uint8Array.from([0, 1, 2, 3]), helia.blockstore)

    const events: ProgressEvent[] = []

    await helia.pins.add(cidV1, {
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
    const cidV1 = await createAndPutBlock(raw.code, Uint8Array.from([0, 1, 2, 3]), helia.blockstore)
    const cidV0 = CID.createV0(cidV1.multihash)

    await helia.pins.add(cidV1)

    await expect(helia.pins.isPinned(cidV1)).to.eventually.be.true('did not pin v1 CID')
    await expect(helia.pins.isPinned(cidV0)).to.eventually.be.true('did not pin v0 CID')

    await helia.pins.rm(cidV1)

    await expect(helia.pins.isPinned(cidV1)).to.eventually.be.false('did not unpin v1 CID')
    await expect(helia.pins.isPinned(cidV0)).to.eventually.be.false('did not unpin v0 CID')
  })

  it('does not delete a pinned block', async () => {
    const cid = await createAndPutBlock(raw.code, Uint8Array.from([0, 1, 2, 3]), helia.blockstore)

    await helia.pins.add(cid)

    await expect(helia.blockstore.delete(cid)).to.eventually.be.rejected
      .with.property('message', 'CID was pinned')
  })

  it('lists pins created with default args', async () => {
    const cidV1 = await createAndPutBlock(raw.code, Uint8Array.from([0, 1, 2, 3]), helia.blockstore)

    await helia.pins.add(cidV1)

    const pins = await all(helia.pins.ls())

    expect(pins).to.have.lengthOf(1)
    expect(pins).to.have.nested.property('[0].cid').that.eql(cidV1)
    expect(pins).to.have.nested.property('[0].depth', Infinity)
    expect(pins).to.have.nested.property('[0].metadata').that.eql({})
  })

  it('lists pins with depth', async () => {
    const cidV1 = await createAndPutBlock(raw.code, Uint8Array.from([0, 1, 2, 3]), helia.blockstore)

    await helia.pins.add(cidV1, {
      depth: 5
    })

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

    await helia.pins.add(cidV1, {
      metadata
    })

    const pins = await all(helia.pins.ls())

    expect(pins).to.have.lengthOf(1)
    expect(pins).to.have.nested.property('[0].cid').that.eql(cidV1)
    expect(pins).to.have.nested.property('[0].metadata').that.eql(metadata)
  })

  it('lists pins directly', async () => {
    const cid1 = await createAndPutBlock(raw.code, Uint8Array.from([0, 1, 2, 3]), helia.blockstore)
    const cid2 = await createAndPutBlock(raw.code, Uint8Array.from([4, 5, 6, 7]), helia.blockstore)

    await helia.pins.add(cid1)
    await helia.pins.add(cid2)

    const pins = await all(helia.pins.ls({
      cid: cid1
    }))

    expect(pins).to.have.lengthOf(1)
    expect(pins).to.have.nested.property('[0].cid').that.eql(cid1)
    expect(pins).to.have.nested.property('[0].depth', Infinity)
    expect(pins).to.have.nested.property('[0].metadata').that.eql({})
  })

  it('pins a block from another node', async () => {
    await helia.libp2p.dial(remote.libp2p.getMultiaddrs())

    const cid1 = await createAndPutBlock(raw.code, Uint8Array.from([0, 1, 2, 3]), remote.blockstore)

    await helia.pins.add(cid1)

    const pins = await all(helia.pins.ls())

    expect(pins).to.have.lengthOf(1)
    expect(pins).to.have.nested.property('[0].cid').that.eql(cid1)
    expect(pins).to.have.nested.property('[0].depth', Infinity)
    expect(pins).to.have.nested.property('[0].metadata').that.eql({})
  })
})
