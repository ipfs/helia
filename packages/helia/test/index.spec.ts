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
import { CID } from 'multiformats/cid'
import { Key } from 'interface-datastore'

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
    expect(helia.libp2p.isStarted()).to.be.true()

    await helia.stop()

    expect(helia.libp2p.isStarted()).to.be.false()
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

    expect(helia.libp2p.isStarted()).to.be.false()
  })

  it('does not require any constructor args', async () => {
    const helia = await createHelia()

    const cid = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3F')
    const block = Uint8Array.from([0, 1, 2, 3])
    await helia.blockstore.put(cid, block)
    await expect(helia.blockstore.has(cid)).to.eventually.be.true()

    const key = new Key(`/${cid.toString()}`)
    await helia.datastore.put(key, block)
    await expect(helia.datastore.has(key)).to.eventually.be.true()

    expect(() => {
      helia.libp2p.isStarted()
    }).to.throw('Please configure Helia with a libp2p instance')
  })
})
