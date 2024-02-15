/* eslint-env mocha */
import { dagCbor } from '@helia/dag-cbor'
import * as ipldDagCbor from '@ipld/dag-cbor'
import { stop } from '@libp2p/interface'
import { expect } from 'aegir/chai'
import { VerifiedFetch } from '../src/verified-fetch.js'
import { createHelia } from './fixtures/create-offline-helia.js'
import type { Helia } from '@helia/interface'

describe('accept header', () => {
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

  it('should allow specifying application/vnd.ipld.raw accept header to skip data decoding', async () => {
    // JSON-compliant CBOR - if decoded would otherwise cause `Content-Type` to
    // be set to `application/json`
    const obj = {
      hello: 'world'
    }
    const c = dagCbor(helia)
    const cid = await c.add(obj)

    const resp = await verifiedFetch.fetch(cid, {
      headers: {
        accept: 'application/vnd.ipld.raw'
      }
    })
    expect(resp.headers.get('content-type')).to.equal('application/vnd.ipld.raw')

    const output = ipldDagCbor.decode(new Uint8Array(await resp.arrayBuffer()))
    expect(output).to.deep.equal(obj)
  })

  it('should allow specifying application/octet-stream accept header to skip data decoding', async () => {
    // JSON-compliant CBOR - if decoded would otherwise cause `Content-Type` to
    // be set to `application/json`
    const obj = {
      hello: 'world'
    }
    const c = dagCbor(helia)
    const cid = await c.add(obj)

    const resp = await verifiedFetch.fetch(cid, {
      headers: {
        accept: 'application/octet-stream'
      }
    })
    expect(resp.headers.get('content-type')).to.equal('application/octet-stream')

    const output = ipldDagCbor.decode(new Uint8Array(await resp.arrayBuffer()))
    expect(output).to.deep.equal(obj)
  })

  it('should return 406 Not Acceptable if the accept header cannot be honoured', async () => {
    const obj = {
      hello: 'world'
    }
    const c = dagCbor(helia)
    const cid = await c.add(obj)

    const resp = await verifiedFetch.fetch(cid, {
      headers: {
        accept: 'application/what-even-is-this'
      }
    })
    expect(resp.status).to.equal(406)
    expect(resp.statusText).to.equal('406 Not Acceptable')
  })

  it('should suuport wildcards', async () => {
    const obj = {
      hello: 'world'
    }
    const c = dagCbor(helia)
    const cid = await c.add(obj)

    const resp = await verifiedFetch.fetch(cid, {
      headers: {
        accept: 'application/what-even-is-this, */*'
      }
    })
    expect(resp.status).to.equal(200)
    expect(resp.headers.get('content-type')).to.equal('application/octet-stream')
  })
})
