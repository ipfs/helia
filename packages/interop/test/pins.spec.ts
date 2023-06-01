/* eslint-env mocha */

import { expect } from 'aegir/chai'
import all from 'it-all'
import { CID } from 'multiformats/cid'
import * as raw from 'multiformats/codecs/raw'
import { sha256 } from 'multiformats/hashes/sha2'
import { createHeliaNode } from './fixtures/create-helia.js'
import { createKuboNode } from './fixtures/create-kubo.js'
import type { Helia } from '@helia/interface'
import type { Controller } from 'ipfsd-ctl'

describe('pins', () => {
  let helia: Helia
  let kubo: Controller

  beforeEach(async () => {
    helia = await createHeliaNode()
    kubo = await createKuboNode()

    // connect the two nodes
    await helia.libp2p.dial(kubo.peer.addresses)
  })

  afterEach(async () => {
    if (helia != null) {
      await helia.stop()
    }

    if (kubo != null) {
      await kubo.stop()
    }
  })

  it('pinning on kubo should pull from helia', async () => {
    const input = Uint8Array.from([0, 1, 2, 3, 4])
    const digest = await sha256.digest(input)
    const cid = CID.createV1(raw.code, digest)

    expect((await all(kubo.api.refs.local())).map(r => r.ref)).to.not.include(cid.toString())

    await helia.blockstore.put(cid, input)

    const pinned = await kubo.api.pin.add(cid)
    expect(pinned.toString()).to.equal(cid.toString())

    expect((await all(kubo.api.refs.local())).map(r => r.ref)).to.include(cid.toString())
  })

  it('pinning on helia should pull from kubo', async () => {
    const input = Uint8Array.from([0, 1, 2, 3, 4])
    const { cid } = await kubo.api.add({ content: input }, {
      cidVersion: 1,
      rawLeaves: true
    })

    await expect(helia.blockstore.has(cid)).to.eventually.be.false()

    const output = await helia.pins.add(cid)

    await expect(helia.blockstore.has(cid)).to.eventually.be.true()

    expect(output.cid.toString()).to.equal(cid.toString())
  })
})
