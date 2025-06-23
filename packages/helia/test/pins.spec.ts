/* eslint-env mocha */

import { webSockets } from '@libp2p/websockets'
import * as Filters from '@libp2p/websockets/filters'
import { multiaddr } from '@multiformats/multiaddr'
import { expect } from 'aegir/chai'
import all from 'it-all'
import drain from 'it-drain'
import { CID } from 'multiformats/cid'
import { createHelia } from '../src/index.js'
import type { Helia } from '@helia/interface'
import type { Libp2p } from '@libp2p/interface'

describe('pins', () => {
  let helia: Helia

  beforeEach(async () => {
    helia = await createHelia({
      libp2p: {
        addresses: {
          listen: []
        },
        connectionGater: {
          denyDialMultiaddr: () => false
        },
        transports: [
          webSockets({
            filter: Filters.all
          })
        ]
      }
    })
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
