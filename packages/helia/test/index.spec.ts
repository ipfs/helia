/* eslint-env mocha */
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { webSockets } from '@libp2p/websockets'
import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { createLibp2p } from 'libp2p'
import { createHelia, type HeliaLibp2p } from '../src/index.js'

describe('helia', () => {
  let helia: HeliaLibp2p<any>

  beforeEach(async () => {
    helia = await createHelia({
      datastore: new MemoryDatastore(),
      blockstore: new MemoryBlockstore(),
      libp2p: await createLibp2p({
        transports: [
          webSockets()
        ],
        connectionEncryption: [
          noise()
        ],
        streamMuxers: [
          yamux()
        ]
      })
    })
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
})
