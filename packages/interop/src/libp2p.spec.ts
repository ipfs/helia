import { withLibp2p } from '@helia/libp2p'
import { identify } from '@libp2p/identify'
import { webSockets } from '@libp2p/websockets'
import { expect } from 'aegir/chai'
import { createHeliaLight } from 'helia'
import { createLibp2p, isLibp2p } from 'libp2p'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import type { HeliaWithLibp2p } from '@helia/libp2p'

describe('@helia/libp2p', () => {
  let helia: HeliaWithLibp2p<any>

  beforeEach(() => {
    helia = withLibp2p(createHeliaLight())
  })

  afterEach(async () => {
    if (helia != null) {
      await helia.stop()
    }
  })

  it('should add a libp2p property', async () => {
    await helia.start()
    expect(isLibp2p(helia.libp2p)).to.be.true()
  })

  it('should start libp2p', async () => {
    await helia.start()
    await helia.stop()

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
    helia = await withLibp2p(createHeliaLight(), await createLibp2p({
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

    const peer = await helia.libp2p.peerStore.get(helia.libp2p.peerId)
    const agentVersionBuf = peer.metadata.get('AgentVersion')

    if (agentVersionBuf == null) {
      throw new Error('AgentVersion not stored')
    }

    expect(agentVersionBuf).to.be.ok()
    expect(uint8ArrayToString(agentVersionBuf)).to.not.include('helia/')
  })

  it('should have the same peer id after a restart', async () => {
    await helia.start()

    const datastore = helia.datastore
    const peerId = helia.libp2p.peerId

    await helia.stop()

    helia = await withLibp2p(createHeliaLight({
      datastore
    }), {
      datastore
    }).start()

    expect(helia.libp2p.peerId.toString()).to.equal(peerId.toString())
  })

  it('allows passing a libp2p node', async () => {
    const libp2p = await createLibp2p()

    helia = await withLibp2p(createHeliaLight(), libp2p).start()

    expect(helia.libp2p).to.equal(libp2p)
  })

  it('adds helia details to the AgentVersion', async () => {
    await helia.start()

    expect(helia).to.have.nested.property('libp2p.services.identify.host.agentVersion')
      .that.includes('helia/')
  })
})
