import { webSockets } from '@libp2p/websockets'
import { multiaddr } from '@multiformats/multiaddr'
import { expect } from 'aegir/chai'
import { createHelia } from 'helia'
import all from 'it-all'
import drain from 'it-drain'
import { createLibp2p } from 'libp2p'
import { CID } from 'multiformats/cid'
import { withLibp2p } from '../src/index.ts'
import type { HeliaWithLibp2p } from '../src/index.ts'

describe('pins', () => {
  let helia: HeliaWithLibp2p<any>

  beforeEach(async () => {
    helia = await withLibp2p(createHelia(), await createLibp2p({
      addresses: {
        listen: []
      },
      connectionGater: {
        denyDialMultiaddr: () => false
      },
      transports: [
        webSockets()
      ]
    })).start()
  })

  afterEach(async () => {
    if (helia != null) {
      await helia.stop()
    }
  })

  it('pins a block from another node', async () => {
    const cid = CID.parse(process.env.BLOCK_CID ?? '')
    await helia.libp2p.dial(multiaddr(process.env.RELAY_SERVER))
    await drain(helia.pins.add(cid))

    const pins = await all(helia.pins.ls())

    expect(pins).to.have.lengthOf(1)
    expect(pins).to.have.nested.property('[0].cid').that.eql(cid)
    expect(pins).to.have.nested.property('[0].depth', Infinity)
    expect(pins).to.have.nested.property('[0].metadata').that.eql({})
  })
})
