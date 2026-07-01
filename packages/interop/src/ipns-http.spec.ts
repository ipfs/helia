import { delegatedHTTPRouter } from '@helia/delegated-routing-client'
import { ipns } from '@helia/ipns'
import { peerIdFromCID } from '@libp2p/peer-id'
import { expect } from 'aegir/chai'
import { createHelia } from 'helia'
import last from 'it-last'
import { CID } from 'multiformats/cid'
import { isNode } from 'wherearewe'
import { createKuboNode } from './fixtures/create-kubo.ts'
import type { Helia } from '@helia/interface'
import type { IPNS } from '@helia/ipns'
import type { KuboNode } from 'ipfsd-ctl'

describe('@helia/ipns - http', () => {
  let helia: Helia
  let kubo: KuboNode
  let name: IPNS

  /**
   * Ensure that for the CID we are going to publish, the resolver has a peer ID that
   * is KAD-closer to the routing key so we can predict the the resolver will receive
   * the DHT record containing the IPNS record
   */
  beforeEach(async () => {
    kubo = await createKuboNode()
    const kuboInfo = await kubo.info()
    helia = await createHelia({
      routers: [
        delegatedHTTPRouter({
          url: kuboInfo.gateway
        })
      ]
    }).start()

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
      type: 'ed25519'
    })

    const res = await kubo.api.name.publish(cid, {
      key: keyName
    })

    const key = peerIdFromCID(CID.parse(res.name))
    const result = await last(name.resolve(key.toMultihash()))

    if (result == null) {
      throw new Error('No results found')
    }

    expect(result.value).to.equal(`/ipfs/${cid}`)
  })
})
