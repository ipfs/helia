import { dagCbor } from '@helia/dag-cbor'
import { dagJson } from '@helia/dag-json'
import { ipns } from '@helia/ipns'
import * as ipldDagCbor from '@ipld/dag-cbor'
import * as ipldDagJson from '@ipld/dag-json'
import { stop } from '@libp2p/interface'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { expect } from 'aegir/chai'
import { marshal } from 'ipns'
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

  it('should transform DAG-CBOR to DAG-JSON', async () => {
    const obj = {
      hello: 'world'
    }
    const c = dagCbor(helia)
    const cid = await c.add(obj)

    const resp = await verifiedFetch.fetch(cid, {
      headers: {
        accept: 'application/vnd.ipld.dag-json'
      }
    })
    expect(resp.headers.get('content-type')).to.equal('application/vnd.ipld.dag-json')

    const output = ipldDagJson.decode(new Uint8Array(await resp.arrayBuffer()))
    expect(output).to.deep.equal(obj)
  })

  it('should transform DAG-CBOR to JSON', async () => {
    const obj = {
      hello: 'world'
    }
    const c = dagCbor(helia)
    const cid = await c.add(obj)

    const resp = await verifiedFetch.fetch(cid, {
      headers: {
        accept: 'application/json'
      }
    })
    expect(resp.headers.get('content-type')).to.equal('application/json')

    const output = ipldDagJson.decode(new Uint8Array(await resp.arrayBuffer()))
    expect(output).to.deep.equal(obj)
  })

  it('should transform DAG-JSON to DAG-CBOR', async () => {
    const obj = {
      hello: 'world'
    }
    const j = dagJson(helia)
    const cid = await j.add(obj)

    const resp = await verifiedFetch.fetch(cid, {
      headers: {
        accept: 'application/vnd.ipld.dag-cbor'
      }
    })
    expect(resp.headers.get('content-type')).to.equal('application/vnd.ipld.dag-cbor')

    const output = ipldDagCbor.decode(new Uint8Array(await resp.arrayBuffer()))
    expect(output).to.deep.equal(obj)
  })

  it('should transform DAG-JSON to CBOR', async () => {
    const obj = {
      hello: 'world'
    }
    const j = dagJson(helia)
    const cid = await j.add(obj)

    const resp = await verifiedFetch.fetch(cid, {
      headers: {
        accept: 'application/cbor'
      }
    })
    expect(resp.headers.get('content-type')).to.equal('application/cbor')

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

  it('should support wildcards', async () => {
    const obj = {
      hello: 'world'
    }
    const c = dagCbor(helia)
    const cid = await c.add(obj)

    const resp = await verifiedFetch.fetch(cid, {
      headers: {
        accept: 'application/what-even-is-this, */*, application/vnd.ipld.raw'
      }
    })
    expect(resp.status).to.equal(200)
    expect(resp.headers.get('content-type')).to.equal('application/json')
  })

  it('should support type wildcards', async () => {
    const obj = {
      hello: 'world'
    }
    const c = dagCbor(helia)
    const cid = await c.add(obj)

    const resp = await verifiedFetch.fetch(cid, {
      headers: {
        accept: '*/json, application/vnd.ipld.raw'
      }
    })
    expect(resp.status).to.equal(200)
    expect(resp.headers.get('content-type')).to.equal('application/json')
  })

  it('should support subtype wildcards', async () => {
    const obj = {
      hello: 'world'
    }
    const c = dagCbor(helia)
    const cid = await c.add(obj)

    const resp = await verifiedFetch.fetch(cid, {
      headers: {
        accept: 'application/*, application/vnd.ipld.raw'
      }
    })
    expect(resp.status).to.equal(200)
    expect(resp.headers.get('content-type')).to.equal('application/json')
  })

  it('should support q-factor weighting', async () => {
    const obj = {
      hello: 'world'
    }
    const c = dagCbor(helia)
    const cid = await c.add(obj)

    const resp = await verifiedFetch.fetch(cid, {
      headers: {
        // these all match, application/json would be chosen as it is first but
        // application/octet-stream has a higher weighting so it should win
        accept: [
          'application/json;q=0.1',
          'application/application/vnd.ipld.raw;q=0.5',
          'application/octet-stream;q=0.8'
        ].join(', ')
      }
    })
    expect(resp.status).to.equal(200)
    expect(resp.headers.get('content-type')).to.equal('application/octet-stream')
  })

  it.skip('should support fetching IPNS records', async () => {
    const peerId = await createEd25519PeerId()
    const obj = {
      hello: 'world'
    }
    const c = dagCbor(helia)
    const cid = await c.add(obj)

    const i = ipns(helia)
    const record = await i.publish(peerId, cid)

    const resp = await verifiedFetch.fetch(`ipns://${peerId}`, {
      headers: {
        accept: 'application/vnd.ipfs.ipns-record'
      }
    })
    expect(resp.status).to.equal(200)
    expect(resp.headers.get('content-type')).to.equal('application/vnd.ipfs.ipns-record')
    const buf = await resp.arrayBuffer()

    expect(buf).to.equalBytes(marshal(record))
  })
})
