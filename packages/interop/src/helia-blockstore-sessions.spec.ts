import { stop } from '@libp2p/interface'
import { multiaddr } from '@multiformats/multiaddr'
import { expect } from 'aegir/chai'
import toBuffer from 'it-to-buffer'
import { CID } from 'multiformats/cid'
import { createHeliaNode } from './fixtures/create-helia.js'
import { createKuboNode } from './fixtures/create-kubo.js'
import type { Helia } from 'helia'
import type { KuboInfo, KuboNode } from 'ipfsd-ctl'

describe('helia - blockstore sessions', () => {
  let helia: Helia
  let kubo: KuboNode
  let kuboInfo: KuboInfo
  let kubo2: KuboNode
  let kubo2Info: KuboInfo

  beforeEach(async () => {
    helia = await createHeliaNode()
    kubo = await createKuboNode()
    kuboInfo = await kubo.info()
    kubo2 = await createKuboNode()
    kubo2Info = await kubo2.info()
  })

  afterEach(async () => {
    await stop(helia, kubo, kubo2)
  })

  it('should be able to receive a block from a peer', async () => {
    const input = Uint8Array.from([0, 1, 2, 3, 4])
    const { cid } = await kubo.api.add({ content: input }, {
      cidVersion: 1,
      rawLeaves: true
    })

    await helia.libp2p.dial(kuboInfo.multiaddrs.map(str => multiaddr(str)))

    const output = await toBuffer(helia.blockstore.get(CID.parse(cid.toString())))

    expect(output).to.equalBytes(input)
  })

  it('should be able to receive a block from a session provider', async () => {
    const input = Uint8Array.from([0, 1, 2, 3, 4])
    const { cid } = await kubo.api.add({ content: input }, {
      cidVersion: 1,
      rawLeaves: true
    })
    const root = CID.parse(cid.toString())

    const session = helia.blockstore.createSession(root, {
      providers: [
        kuboInfo.multiaddrs.map(str => multiaddr(str))
      ]
    })

    const output = await toBuffer(session.get(root))

    expect(output).to.equalBytes(input)
  })

  it('should be able to add peers to a session after creation', async () => {
    const input = Uint8Array.from([0, 1, 2, 3, 4])
    const { cid } = await kubo2.api.add({ content: input }, {
      cidVersion: 1,
      rawLeaves: true
    })
    const root = CID.parse(cid.toString())

    const session = helia.blockstore.createSession(root, {
      providers: [
        kuboInfo.multiaddrs.map(str => multiaddr(str))
      ]
    })

    await expect(toBuffer(session.get(root))).to.eventually.be.rejected
      .with.property('name', 'LoadBlockFailedError')

    await Promise.all(
      kubo2Info.multiaddrs.map(async (str) => session.addPeer(multiaddr(str)))
    )

    const output = await toBuffer(session.get(root))

    expect(output).to.equalBytes(input)
  })
})
