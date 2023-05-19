/* eslint-env mocha */

import { expect } from 'aegir/chai'
import { Key } from 'interface-datastore'
import { CID } from 'multiformats/cid'
import { createHelia } from '../src/index.js'
import type { Helia } from '@helia/interface'

describe('helia factory', () => {
  let helia: Helia

  afterEach(async () => {
    if (helia != null) {
      await helia.stop()
    }
  })

  it('allows creating offline node', async () => {
    helia = await createHelia({
      start: false
    })

    expect(helia.libp2p.isStarted()).to.be.false()
  })

  it('does not require any constructor args', async () => {
    helia = await createHelia()

    const cid = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3F')
    const block = Uint8Array.from([0, 1, 2, 3])
    await helia.blockstore.put(cid, block)
    expect(await helia.blockstore.has(cid)).to.be.true()

    const key = new Key(`/${cid.toString()}`)
    await helia.datastore.put(key, block)
    expect(await helia.datastore.has(key)).to.be.true()
  })
})
