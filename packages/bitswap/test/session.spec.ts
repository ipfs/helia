import { defaultLogger } from '@libp2p/logger'
import { PeerMap } from '@libp2p/peer-collections'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { expect } from 'aegir/chai'
import { CID } from 'multiformats/cid'
import { stubInterface, type StubbedInstance } from 'sinon-ts'
import { createBitswapSession } from '../src/session.js'
import type { BitswapSession } from '../src/index.js'
import type { Network } from '../src/network.js'
import type { WantList } from '../src/want-list.js'

interface StubbedBitswapSessionComponents {
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
      network: stubInterface<Network>(),
      wantList: stubInterface<WantList>({
        peers: new PeerMap()
      })
    }
  })

  it('should only query session peers', async () => {
    const peerId = await createEd25519PeerId()
    const data = new Uint8Array([0, 1, 2, 3, 4])

    components.network.findProviders.returns(async function * () {
      yield {
        id: peerId,
        multiaddrs: [],
        protocols: ['']
      }
    }())

    components.wantList.wantPresence.resolves({
      sender: peerId,
      cid,
      has: true
    })

    components.wantList.wantBlock.resolves({
      sender: peerId,
      cid,
      block: data
    })

    session = await createBitswapSession({
      ...components,
      logger: defaultLogger()
    }, {
      root: cid,
      queryConcurrency: 5,
      minProviders: 1,
      maxProviders: 3,
      connectedPeers: []
    })

    const p = session.want(cid)

    expect(components.wantList.wantBlock.called).to.be.true()
    expect(components.wantList.wantBlock.getCall(0).args[1]?.peerId?.toString()).to.equal(peerId.toString())

    await expect(p).to.eventually.deep.equal(data)
  })
})
