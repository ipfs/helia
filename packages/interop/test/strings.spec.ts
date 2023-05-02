/* eslint-env mocha */

import { strings, type Strings, type AddOptions } from '@helia/strings'
import { expect } from 'aegir/chai'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { createHeliaNode } from './fixtures/create-helia.js'
import { createKuboNode } from './fixtures/create-kubo.js'
import type { Helia } from '@helia/interface'
import type { PutOptions as KuboAddOptions } from 'ipfs-core-types/src/block/index.js'
import type { Controller } from 'ipfsd-ctl'

describe('strings interop', () => {
  let helia: Helia
  let str: Strings
  let kubo: Controller

  async function expectSameCid (data: () => string, heliaOpts: Partial<AddOptions> = {}, kuboOpts: KuboAddOptions = {}): Promise<void> {
    const heliaCid = await str.add(data(), heliaOpts)
    const kuboCid = await kubo.api.block.put(uint8ArrayFromString(data()), kuboOpts)

    expect(heliaCid.toString()).to.equal(kuboCid.toString())
  }

  beforeEach(async () => {
    helia = await createHeliaNode()
    str = strings(helia)
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
    const candidate = (): string => 'hello world'

    await expectSameCid(candidate)
  })

  it('should add to helia and fetch from kubo', async () => {
    const input = 'hello world'
    const cid = await str.add(input)
    const block = await kubo.api.block.get(cid)
    const output = uint8ArrayToString(block)

    expect(output).to.equal(input)
  })

  it('should add to kubo and fetch from helia', async () => {
    const input = 'hello world'
    const cid = await kubo.api.block.put(uint8ArrayFromString(input))
    const output = await str.get(cid)

    expect(output).to.equal(input)
  })
})
