import { expect } from 'aegir/chai'
import { createHelia } from '../src/index.js'
import type { Helia } from '@helia/interface'

describe('helia', () => {
  let helia: Helia

  beforeEach(async () => {
    helia = await createHelia()
  })

  afterEach(async () => {
    if (helia != null) {
      await helia.stop()
    }
  })

  it('stops and starts', async () => {
    expect(helia.libp2p.status).to.equal('started')

    await helia.stop()

    expect(helia.libp2p.status).to.equal('stopped')
  })

  it('should have a blockstore', async () => {
    expect(helia).to.have.property('blockstore').that.is.ok()
  })

  it('should have a datastore', async () => {
    expect(helia).to.have.property('datastore').that.is.ok()
  })

  it('should have a libp2p', async () => {
    expect(helia).to.have.property('libp2p').that.is.ok()
  })

  it('should have the same peer id after a restart', async () => {
    const datastore = helia.datastore
    const peerId = helia.libp2p.peerId

    await helia.stop()

    helia = await createHelia({
      datastore
    })

    expect(helia.libp2p.peerId.toString()).to.equal(peerId.toString())
  })
})
