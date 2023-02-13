/* eslint-env mocha */
import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { createLibp2p } from 'libp2p'
import { webSockets } from '@libp2p/websockets'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { createHelia } from '../src/index.js'
import type { Helia } from '@helia/interface'

describe('helia', () => {
  let helia: Helia

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
    const startedInfo = await helia.info()

    expect(startedInfo).to.have.property('status', 'running')
    expect(startedInfo).to.have.property('protocols')
      .with.property('length').that.is.greaterThan(0)

    await helia.stop()

    const stoppedInfo = await helia.info()

    expect(stoppedInfo).to.have.property('status', 'stopped')
    expect(stoppedInfo).to.have.property('protocols')
      .with.lengthOf(0)
  })

  it('returns node information', async () => {
    const info = await helia.info()

    expect(info).to.have.property('peerId').that.is.ok()
    expect(info).to.have.property('multiaddrs').that.is.an('array')
    expect(info).to.have.property('agentVersion').that.is.a('string')
    expect(info).to.have.property('protocolVersion').that.is.a('string')
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

  it('allows creating offline node', async () => {
    const helia = await createHelia({
      start: false,
      datastore: new MemoryDatastore(),
      blockstore: new MemoryBlockstore(),
      libp2p: await createLibp2p({
        start: false,
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

    const info = await helia.info()

    expect(info).to.have.property('status', 'stopped')
  })
})
