import { defaultLogger } from '@libp2p/logger'
import { PeerSet } from '@libp2p/peer-collections'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { expect } from 'aegir/chai'
import { CID } from 'multiformats/cid'
import { stubInterface, type StubbedInstance } from 'sinon-ts'
import { type Network } from '../src/network.js'
import { WantType } from '../src/pb/message.js'
import { WantList } from '../src/want-list.js'

interface StubbedWantListComponents {
  network: StubbedInstance<Network>
}

describe('wantlist', () => {
  let wantList: WantList
  let components: StubbedWantListComponents

  beforeEach(() => {
    components = {
      network: stubInterface<Network>()
    }

    wantList = new WantList({
      ...components,
      logger: defaultLogger()
    })

    wantList.start()
  })

  afterEach(() => {
    if (wantList != null) {
      wantList.stop()
    }
  })

  it('should add peers to peer list on connect', async () => {
    const peerId = await createEd25519PeerId()

    await wantList.connected(peerId)

    expect(wantList.peers.has(peerId)).to.be.true()
  })

  it('should remove peers to peer list on disconnect', async () => {
    const peerId = await createEd25519PeerId()

    await wantList.connected(peerId)

    expect(wantList.peers.has(peerId)).to.be.true()

    wantList.disconnected(peerId)

    expect(wantList.peers.has(peerId)).to.be.false()
  })

  it('should want blocks', async () => {
    const cid = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3F')
    const peerId = await createEd25519PeerId()

    await wantList.connected(peerId)

    components.network.sendMessage.withArgs(peerId).resolves()
    await wantList.wantBlocks([cid])

    const sentToPeer = components.network.sendMessage.getCall(0).args[0]
    expect(sentToPeer.toString()).equal(peerId.toString())

    const sentMessage = components.network.sendMessage.getCall(0).args[1]
    expect(sentMessage).to.have.nested.property('wantlist.full', false)
    expect(sentMessage).to.have.deep.nested.property('wantlist.entries[0].cid', cid.bytes)
    expect(sentMessage).to.have.nested.property('wantlist.entries[0].wantType', WantType.WantBlock)
    expect(sentMessage).to.have.nested.property('wantlist.entries[0].cancel', false)
  })

  it('should cancel wants', async () => {
    const cid = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3F')
    const peerId = await createEd25519PeerId()
    components.network.sendMessage.withArgs(peerId).resolves()

    await wantList.connected(peerId)

    await wantList.wantBlocks([cid])

    expect([...wantList.wants.values()].find(want => want.cid.equals(cid))).to.be.ok()

    // now cancel
    await wantList.cancelWants([cid])

    const sentToPeer = components.network.sendMessage.getCall(1).args[0]
    expect(sentToPeer.toString()).equal(peerId.toString())

    const sentMessage = components.network.sendMessage.getCall(1).args[1]
    expect(sentMessage).to.have.nested.property('wantlist.full', false)
    expect(sentMessage).to.have.deep.nested.property('wantlist.entries[0].cid').that.equalBytes(cid.bytes)
    expect(sentMessage).to.have.nested.property('wantlist.entries[0].wantType', WantType.WantBlock)
    expect(sentMessage).to.have.nested.property('wantlist.entries[0].cancel', true)

    expect([...wantList.wants.values()].find(want => want.cid.equals(cid))).to.be.undefined()
  })

  it('should not send session block wants to non-session peers', async () => {
    const cid = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3F')
    const sessionPeer = await createEd25519PeerId()
    const nonSessionPeer = await createEd25519PeerId()

    await wantList.connected(sessionPeer)
    await wantList.connected(nonSessionPeer)

    await wantList.wantBlocks([cid], {
      session: new PeerSet([sessionPeer])
    })

    expect(components.network.sendMessage.callCount).to.equal(1)

    const sentToPeer = components.network.sendMessage.getCall(0).args[0]
    expect(sentToPeer.toString()).equal(sessionPeer.toString())

    const sentMessage = components.network.sendMessage.getCall(0).args[1]
    expect(sentMessage).to.have.nested.property('wantlist.full', false)
    expect(sentMessage).to.have.deep.nested.property('wantlist.entries[0].cid', cid.bytes)
    expect(sentMessage).to.have.nested.property('wantlist.entries[0].wantType', WantType.WantBlock)
    expect(sentMessage).to.have.nested.property('wantlist.entries[0].cancel', false)
  })
})
