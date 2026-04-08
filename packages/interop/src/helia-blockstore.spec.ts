import { randomBytes } from '@libp2p/crypto'
import { multiaddr } from '@multiformats/multiaddr'
import { expect } from 'aegir/chai'
import drain from 'it-drain'
import toBuffer from 'it-to-buffer'
import { CID } from 'multiformats/cid'
import * as raw from 'multiformats/codecs/raw'
import { sha256 } from 'multiformats/hashes/sha2'
import { createHeliaNode } from './fixtures/create-helia.ts'
import { createKuboNode } from './fixtures/create-kubo.ts'
import type { Helia } from 'helia'
import type { KuboInfo, KuboNode } from 'ipfsd-ctl'

describe('helia - blockstore', () => {
  let helia: Helia
  let kubo: KuboNode
  let kuboInfo: KuboInfo

  beforeEach(async () => {
    helia = await createHeliaNode()
    kubo = await createKuboNode()
    kuboInfo = await kubo.info()

    // connect the two nodes
    await helia.libp2p.dial(kuboInfo.multiaddrs.map(str => multiaddr(str)))
  })

  afterEach(async () => {
    if (helia != null) {
      await helia.stop()
    }

    if (kubo != null) {
      await kubo.stop()
    }
  })

  it('should be able to send a block', async () => {
    const input = randomBytes(10)
    const digest = await sha256.digest(input)
    const cid = CID.createV1(raw.code, digest)
    await helia.blockstore.put(cid, input)
    const output = await toBuffer(kubo.api.cat(cid))

    expect(output).to.equalBytes(input)
  })

  it('should be able to receive a block', async () => {
    const input = randomBytes(10)
    const { cid } = await kubo.api.add({ content: input }, {
      cidVersion: 1,
      rawLeaves: true
    })
    const output = await toBuffer(helia.blockstore.get(CID.parse(cid.toString())))

    expect(output).to.equalBytes(input)
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
