import { identify } from '@libp2p/identify'
import { webSockets } from '@libp2p/websockets'
import { expect } from 'aegir/chai'
import { MemoryDatastore } from 'datastore-core'
import { createHelia } from 'helia'
import { createLibp2p, isLibp2p } from 'libp2p'
import { withLibp2p } from '../src/index.ts'
import type { HeliaWithLibp2p } from '../src/index.ts'
import type { Helia } from '@helia/interface'

describe('@helia/libp2p', () => {
  let helia: Helia & HeliaWithLibp2p<any>

  beforeEach(() => {
    helia = withLibp2p(createHelia())
  })

  afterEach(async () => {
    if (helia != null) {
      await helia.stop()
    }
  })

  it('should add a libp2p property', async () => {
    expect(isLibp2p(helia.libp2p)).to.be.true()
  })

  it('should start libp2p', async () => {
    expect(helia.libp2p.status).to.equal('stopped')

    await helia.start()

    expect(helia.libp2p.status).to.equal('started')
  })

  it('should stop libp2p', async () => {
    await helia.start()

    expect(helia.libp2p.status).to.equal('started')

    await helia.stop()

    expect(helia.libp2p.status).to.equal('stopped')
  })

  it('does not add helia details to the AgentVersion when it has been overridden', async () => {
    helia = await withLibp2p(createHelia(), await createLibp2p({
      nodeInfo: {
        userAgent: 'my custom user agent'
      },
      transports: [
        webSockets()
      ],
      services: {
        identify: identify()
      }
    })).start()

    expect(helia).to.have.nested.property('libp2p.services.identify.host.agentVersion')
      .that.does.not.include('helia/')
  })

  it('does not add helia details to the AgentVersion when identify is not configured', async () => {
    helia = await withLibp2p(createHelia(), await createLibp2p({
      transports: [
        webSockets()
      ]
    })).start()

    const peer = await helia.libp2p.peerStore.get(helia.libp2p.peerId)
    const agentVersionBuf = peer.metadata.get('AgentVersion')

    expect(agentVersionBuf).to.be.undefined()
  })

  it('should have the same peer id after a restart', async () => {
    const datastore = helia.datastore
    const peerId = helia.libp2p.peerId

    await helia.stop()

    helia = await withLibp2p(createHelia({
      datastore
    }), await createLibp2p({
      datastore
    })).start()

    expect(helia.libp2p.peerId.toString()).to.equal(peerId.toString())
  })

  it('reuses peer id if reusing datastore', async () => {
    const datastore = new MemoryDatastore()

    helia = await withLibp2p(createHelia({
      datastore
    }), await createLibp2p({
      datastore
    })).start()

    const peerId = helia.libp2p.peerId

    await helia.stop()

    helia = await withLibp2p(createHelia({
      datastore
    }), await createLibp2p({
      datastore
    })).start()

    const otherPeerId = helia.libp2p.peerId

    expect(peerId.toString()).to.equal(otherPeerId.toString())
  })

  it('allows passing a libp2p node', async () => {
    const libp2p = await createLibp2p()

    helia = await withLibp2p(createHelia(), libp2p).start()

    expect(helia.libp2p).to.equal(libp2p)
  })
})
