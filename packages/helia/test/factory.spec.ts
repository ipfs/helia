/* eslint-env mocha */

import { webSockets } from '@libp2p/websockets'
import { expect } from 'aegir/chai'
import { Key } from 'interface-datastore'
import { createLibp2p } from 'libp2p'
import { identifyService } from 'libp2p/identify'
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

  it('adds helia details to the AgentVersion', async () => {
    helia = await createHelia()

    const peer = await helia.libp2p.peerStore.get(helia.libp2p.peerId)
    const agentVersionBuf = peer.metadata.get('AgentVersion')
    const agentVersion = new TextDecoder().decode(agentVersionBuf)

    expect(agentVersion).to.include('helia/')
  })

  it('does not add helia details to the AgentVersion when it has been overridden', async () => {
    helia = await createHelia({
      libp2p: await createLibp2p({
        transports: [
          webSockets()
        ],
        services: {
          identity: identifyService({
            agentVersion: 'my custom agent version'
          })
        }
      })
    })

    const peer = await helia.libp2p.peerStore.get(helia.libp2p.peerId)
    const agentVersionBuf = peer.metadata.get('AgentVersion')
    const agentVersion = new TextDecoder().decode(agentVersionBuf)

    expect(agentVersion).to.not.include('helia/')
  })

  it('does not add helia details to the AgentVersion when identify is not configured', async () => {
    helia = await createHelia({
      libp2p: await createLibp2p({
        transports: [
          webSockets()
        ]
      })
    })

    const peer = await helia.libp2p.peerStore.get(helia.libp2p.peerId)
    const agentVersionBuf = peer.metadata.get('AgentVersion')

    expect(agentVersionBuf).to.be.undefined()
  })
})
