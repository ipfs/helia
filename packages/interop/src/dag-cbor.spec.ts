/* eslint-env mocha */

import { dagCbor } from '@helia/dag-cbor'
import * as codec from '@ipld/dag-cbor'
import { expect } from 'aegir/chai'
import { CID } from 'multiformats/cid'
import { createHeliaNode } from './fixtures/create-helia.js'
import { createKuboNode } from './fixtures/create-kubo.js'
import type { DAGCBOR, AddOptions } from '@helia/dag-cbor'
import type { Helia } from 'helia'
import type { KuboNode } from 'ipfsd-ctl'
import type { AddOptions as KuboAddOptions } from 'kubo-rpc-client'

describe('@helia/dag-cbor', () => {
  let helia: Helia
  let d: DAGCBOR
  let kubo: KuboNode

  async function expectSameCid (data: () => any, heliaOpts: Partial<AddOptions> = {}, kuboOpts: KuboAddOptions = {}): Promise<void> {
    const heliaCid = await d.add(data(), heliaOpts)
    const kuboCid = await kubo.api.dag.put(data(), kuboOpts)

    expect(heliaCid.toString()).to.equal(kuboCid.toString())
  }

  beforeEach(async () => {
    helia = await createHeliaNode()
    d = dagCbor(helia)
    kubo = await createKuboNode()

    await helia.libp2p.dial((await (kubo.api.id())).addresses)
  })

  afterEach(async () => {
    if (helia != null) {
      await helia.stop()
    }

    if (kubo != null) {
      await kubo.stop()
    }
  })

  it('should create the same CID for a string', async () => {
    const candidate = (): any => ({ hello: 'world' })

    await expectSameCid(candidate)
  })

  it('should add to helia and fetch from kubo', async () => {
    const input = { hello: 'world' }
    const cid = await d.add(input)
    const block = await kubo.api.block.get(cid)
    const output = codec.decode(block)

    expect(output).to.deep.equal(input)
  })

  it('should add to kubo and fetch from helia', async () => {
    const input = { hello: 'world' }
    const cid = await kubo.api.block.put(codec.encode(input))
    const output = await d.get(CID.parse(cid.toString()))

    expect(output).to.deep.equal(input)
  })
})
