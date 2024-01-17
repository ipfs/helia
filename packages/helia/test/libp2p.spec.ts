/* eslint-env mocha */

import { expect } from 'aegir/chai'
import { createLibp2p } from 'libp2p'
import { createHelia, type HeliaLibp2p } from '../src/index.js'

describe('libp2p', () => {
  let helia: HeliaLibp2p<any>

  afterEach(async () => {
    if (helia != null) {
      await helia.stop()
    }
  })

  it('allows passing libp2p config', async () => {
    const config = {}

    helia = await createHelia({
      libp2p: config
    })

    expect(Object.keys(helia.libp2p.services)).to.not.be.empty()
  })

  it('allows overriding libp2p config', async () => {
    const config = {
      services: {}
    }

    helia = await createHelia({
      libp2p: config
    })

    expect(Object.keys(helia.libp2p.services)).to.be.empty()
  })

  it('allows passing a libp2p node', async () => {
    const libp2p = await createLibp2p()

    helia = await createHelia({
      libp2p
    })

    expect(helia.libp2p).to.equal(libp2p)
  })
})
