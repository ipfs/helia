/* eslint-env mocha */

import { webSockets } from '@libp2p/websockets'
import { expect } from 'aegir/chai'
import { createLibp2p } from 'libp2p'
import { createHelia } from '../src/index.js'
import type { Helia } from '@helia/interface'

describe('libp2p', () => {
  let helia: Helia

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
    const libp2p = await createLibp2p({
      transports: [
        webSockets()
      ]
    })

    helia = await createHelia({
      libp2p
    })

    expect(helia.libp2p).to.equal(libp2p)
  })
})
