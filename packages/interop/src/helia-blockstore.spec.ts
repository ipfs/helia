/* eslint-env mocha */

import { multiaddr } from '@multiformats/multiaddr'
import { expect } from 'aegir/chai'
import toBuffer from 'it-to-buffer'
import { CID } from 'multiformats/cid'
import * as raw from 'multiformats/codecs/raw'
import { sha256 } from 'multiformats/hashes/sha2'
import { createHeliaNode } from './fixtures/create-helia.js'
import { createKuboNode } from './fixtures/create-kubo.js'
import type { Helia } from 'helia'
import type { KuboInfo, KuboNode } from 'ipfsd-ctl'

describe('helia - blockstore', () => {
  let helia: Helia
  let kubo: KuboNode
  let kuboInfo: KuboInfo

  beforeEach(async () => {
    helia = await createHeliaNode()
    kubo = await createKuboNode()
    kuboInfo = await kubo.info()

    // connect the two nodes
    await helia.libp2p.dial(kuboInfo.multiaddrs.map(str => multiaddr(str)))
  })

  afterEach(async () => {
    if (helia != null) {
      await helia.stop()
    }

    if (kubo != null) {
      await kubo.stop()
    }
  })

  it('should be able to send a block', async () => {
    const input = Uint8Array.from([0, 1, 2, 3, 4])
    const digest = await sha256.digest(input)
    const cid = CID.createV1(raw.code, digest)
    await helia.blockstore.put(cid, input)
    const output = await toBuffer(kubo.api.cat(cid))

    expect(output).to.equalBytes(input)
  })

  it('should be able to receive a block', async () => {
    const input = Uint8Array.from([0, 1, 2, 3, 4])
    const { cid } = await kubo.api.add({ content: input }, {
      cidVersion: 1,
      rawLeaves: true
    })
    const output = await helia.blockstore.get(CID.parse(cid.toString()))

    expect(output).to.equalBytes(input)
  })
})
