import { car } from '@helia/car'
import { dagCbor } from '@helia/dag-cbor'
import { stop } from '@libp2p/interface'
import { expect } from 'aegir/chai'
import { VerifiedFetch } from '../src/verified-fetch.js'
import { createHelia } from './fixtures/create-offline-helia.js'
import { memoryCarWriter } from './fixtures/memory-car.js'
import type { Helia } from '@helia/interface'

describe('car files', () => {
  let helia: Helia
  let verifiedFetch: VerifiedFetch

  beforeEach(async () => {
    helia = await createHelia()
    verifiedFetch = new VerifiedFetch({
      helia
    })
  })

  afterEach(async () => {
    await stop(helia, verifiedFetch)
  })

  it('should support fetching a CAR file', async () => {
    const obj = {
      hello: 'world'
    }
    const c = dagCbor(helia)
    const cid = await c.add(obj)

    const ca = car(helia)
    const writer = memoryCarWriter(cid)
    await ca.export(cid, writer)

    const resp = await verifiedFetch.fetch(cid, {
      headers: {
        accept: 'application/vnd.ipld.car'
      }
    })
    expect(resp.status).to.equal(200)
    expect(resp.headers.get('content-type')).to.equal('application/vnd.ipld.car; version=1')
    expect(resp.headers.get('content-disposition')).to.equal(`attachment; filename="${cid.toString()}.car"`)
    const buf = new Uint8Array(await resp.arrayBuffer())

    expect(buf).to.equalBytes(await writer.bytes())
  })

  it('should support specifying a filename for a CAR file', async () => {
    const obj = {
      hello: 'world'
    }
    const c = dagCbor(helia)
    const cid = await c.add(obj)

    const ca = car(helia)
    const writer = memoryCarWriter(cid)
    await ca.export(cid, writer)

    const resp = await verifiedFetch.fetch(`ipfs://${cid}?filename=foo.bar`, {
      headers: {
        accept: 'application/vnd.ipld.car'
      }
    })
    expect(resp.status).to.equal(200)
    expect(resp.headers.get('content-type')).to.equal('application/vnd.ipld.car; version=1')
    expect(resp.headers.get('content-disposition')).to.equal('attachment; filename="foo.bar"')
  })
})
