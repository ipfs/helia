import { defaultLogger } from '@libp2p/logger'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { expect } from 'aegir/chai'
import { CID } from 'multiformats/cid'
import { stubInterface, type StubbedInstance } from 'sinon-ts'
import { createBitswapSession } from '../src/session.js'
import type { BitswapSession } from '../src/index.js'
import type { Network } from '../src/network.js'
import type { Notifications } from '../src/notifications.js'
import type { WantList } from '../src/want-list.js'

interface StubbedBitswapSessionComponents {
  notifications: StubbedInstance<Notifications>
  network: StubbedInstance<Network>
  wantList: StubbedInstance<WantList>
}

describe('session', () => {
  let components: StubbedBitswapSessionComponents
  let session: BitswapSession
  let cid: CID

  beforeEach(() => {
    cid = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3F')

    components = {
      notifications: stubInterface<Notifications>(),
      network: stubInterface<Network>(),
      wantList: stubInterface<WantList>()
    }

    session = createBitswapSession({
      ...components,
      logger: defaultLogger()
    }, {
      root: cid
    })
  })

  it('should only query session peers', async () => {
    const peerId = await createEd25519PeerId()
    const data = new Uint8Array([0, 1, 2, 3, 4])

    session.peers.add(peerId)

    components.notifications.wantBlock.resolves(data)

    const p = session.want(cid)

    expect(components.wantList.wantBlocks.called).to.be.true()
    expect(components.wantList.wantBlocks.getCall(0)).to.have.nested.property('args[1].session', session.peers)

    await expect(p).to.eventually.deep.equal(data)
  })

  it('should throw when wanting from an empty session', async () => {
    await expect(session.want(cid)).to.eventually.be.rejected
      .with.property('code', 'ERR_NO_SESSION_PEERS')
  })
})
