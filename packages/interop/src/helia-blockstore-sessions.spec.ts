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

  beforeEach(async () => {
    helia = await createHeliaNode()
    kubo = await createKuboNode()
    kuboInfo = await kubo.info()
  })

  afterEach(async () => {
    if (helia != null) {
      await helia.stop()
    }

    if (kubo != null) {
      await kubo.stop()
    }
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
})
