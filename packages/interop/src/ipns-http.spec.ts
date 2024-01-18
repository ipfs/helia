/* eslint-env mocha */

import { ipns } from '@helia/ipns'
import { delegatedHTTPRouting } from '@helia/routers'
import { peerIdFromString } from '@libp2p/peer-id'
import { expect } from 'aegir/chai'
import { isNode } from 'wherearewe'
import { createHeliaHTTP } from './fixtures/create-helia-http.js'
import { createKuboNode } from './fixtures/create-kubo.js'
import type { Helia } from '@helia/interface'
import type { IPNS } from '@helia/ipns'
import type { Controller } from 'ipfsd-ctl'

describe('@helia/ipns - http', () => {
  let helia: Helia
  let kubo: Controller
  let name: IPNS

  /**
   * Ensure that for the CID we are going to publish, the resolver has a peer ID that
   * is KAD-closer to the routing key so we can predict the the resolver will receive
   * the DHT record containing the IPNS record
   */
  beforeEach(async () => {
    kubo = await createKuboNode()
    helia = await createHeliaHTTP({
      routers: [
        delegatedHTTPRouting('http://127.0.0.1:8180')
      ]
    })
    name = ipns(helia)
  })

  afterEach(async () => {
    if (helia != null) {
      await helia.stop()
    }

    if (kubo != null) {
      await kubo.stop()
    }
  })

  it('should publish on kubo and resolve on helia', async function () {
    if (!isNode) {
      // https://github.com/protocol/bifrost-community/issues/4#issuecomment-1898417008
      return this.skip()
    }

    const keyName = 'my-ipns-key'
    const { cid } = await kubo.api.add(Uint8Array.from([0, 1, 2, 3, 4]))

    await kubo.api.key.gen(keyName, {
      // @ts-expect-error the types say upper-case E, Kubo errors unless it's a
      // lower case e
      type: 'ed25519'
    })

    const res = await kubo.api.name.publish(cid, {
      key: keyName
    })

    const key = peerIdFromString(res.name)

    const resolvedCid = await name.resolve(key)
    expect(resolvedCid.toString()).to.equal(cid.toString())
  })
})
