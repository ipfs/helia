/* eslint-env mocha */

import { dagJson, type DAGJSON, type AddOptions } from '@helia/dag-json'
import { expect } from 'aegir/chai'
import * as jsonCodec from 'multiformats/codecs/json'
import { createHeliaNode } from './fixtures/create-helia.js'
import { createKuboNode } from './fixtures/create-kubo.js'
import type { Helia } from '@helia/interface'
import type { PutOptions as KuboAddOptions } from 'ipfs-core-types/src/block/index.js'
import type { Controller } from 'ipfsd-ctl'

describe('dag-json interop', () => {
  let helia: Helia
  let d: DAGJSON
  let kubo: Controller

  async function expectSameCid (data: () => any, heliaOpts: Partial<AddOptions> = {}, kuboOpts: KuboAddOptions = { format: 'dag-json' }): Promise<void> {
    const heliaCid = await d.add(data(), heliaOpts)
    const kuboCid = await kubo.api.block.put(jsonCodec.encode(data()), kuboOpts)

    expect(heliaCid.toString()).to.equal(kuboCid.toString())
  }

  beforeEach(async () => {
    helia = await createHeliaNode()
    d = dagJson(helia)
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
    const output = jsonCodec.decode(block)

    expect(output).to.deep.equal(input)
  })

  it('should add to kubo and fetch from helia', async () => {
    const input = { hello: 'world' }
    const cid = await kubo.api.block.put(jsonCodec.encode(input))
    const output = await d.get(cid)

    expect(output).to.deep.equal(input)
  })
})
