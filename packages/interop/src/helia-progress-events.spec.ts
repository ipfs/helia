import { randomBytes } from '@libp2p/crypto'
import { contentRoutingSymbol } from '@libp2p/interface'
import { peerIdFromString } from '@libp2p/peer-id'
import { CODE_P2P, multiaddr } from '@multiformats/multiaddr'
import { expect } from 'aegir/chai'
import drain from 'it-drain'
import { CID } from 'multiformats/cid'
import { createHeliaNode } from './fixtures/create-helia.ts'
import { createKuboNode } from './fixtures/create-kubo.ts'
import type { Provider, RoutingOptions } from '@libp2p/interface'
import type { Helia } from 'helia'
import type { KuboInfo, KuboNode } from 'ipfsd-ctl'

describe('helia - progress events', () => {
  let helia: Helia
  let kubo: KuboNode
  let kuboInfo: KuboInfo

  beforeEach(async () => {
    kubo = await createKuboNode()
    kuboInfo = await kubo.info()
    const router = {
      get [contentRoutingSymbol] () {
        return router
      },
      findProviders: async function * (cid: CID, options?: RoutingOptions): AsyncIterable<Provider> {
        yield {
          routing: 'dummy',
          id: peerIdFromString(kuboInfo.peerId ?? ''),
          multiaddrs: kuboInfo?.multiaddrs.map(ma => multiaddr(ma).decapsulateCode(CODE_P2P))
        }
      },
      provide: function (cid: CID, options?: RoutingOptions): Promise<void> {
        throw new Error('Function not implemented.')
      },
      cancelReprovide: function (key: CID, options?: RoutingOptions): Promise<void> {
        throw new Error('Function not implemented.')
      },
      put: function (key: Uint8Array, value: Uint8Array, options?: RoutingOptions): Promise<void> {
        throw new Error('Function not implemented.')
      },
      get: function (key: Uint8Array, options?: RoutingOptions): Promise<Uint8Array> {
        throw new Error('Function not implemented.')
      }
    }

    helia = await createHeliaNode({
      services: {
        dummyRouter: () => router
      }
    })
  })

  afterEach(async () => {
    if (helia != null) {
      await helia.stop()
    }

    if (kubo != null) {
      await kubo.stop()
    }
  })

  it('should yield routing events', async () => {
    const input = randomBytes(10)
    const { cid } = await kubo.api.add({ content: input }, {
      cidVersion: 1,
      rawLeaves: true
    })
    const events = new Map<string, number>()
    await drain(helia.blockstore.get(CID.parse(cid.toString()), {
      onProgress (evt) {
        let count = events.get(evt.type) ?? 0
        count++
        events.set(evt.type, count)
      }
    }))

    expect(events.get('helia:routing:find-providers:start')).to.be.greaterThan(0)
    expect(events.get('helia:routing:find-providers:provider')).to.be.greaterThan(0)
    expect(events.get('helia:routing:find-providers:end')).to.be.greaterThan(0)
  })

  it('should yield block broker events', async () => {
    const input = randomBytes(10)
    const { cid } = await kubo.api.add({ content: input }, {
      cidVersion: 1,
      rawLeaves: true
    })
    const events = new Map<string, number>()

    await drain(helia.blockstore.get(CID.parse(cid.toString()), {
      onProgress (evt) {
        let count = events.get(evt.type) ?? 0
        count++
        events.set(evt.type, count)
      }
    }))

    expect(events.get('helia:block-broker:connect')).to.be.greaterThan(0)
    expect(events.get('helia:block-broker:connected')).to.be.greaterThan(0)
    expect(events.get('helia:block-broker:request-block')).to.be.greaterThan(0)
    expect(events.get('helia:block-broker:receive-block')).to.be.greaterThan(0)
  })
})
