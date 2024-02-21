import { dagCbor } from '@helia/dag-cbor'
import { ipns } from '@helia/ipns'
import { stop } from '@libp2p/interface'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { expect } from 'aegir/chai'
import { marshal, unmarshal } from 'ipns'
import { VerifiedFetch } from '../src/verified-fetch.js'
import { createHelia } from './fixtures/create-offline-helia.js'
import type { Helia } from '@helia/interface'
import type { IPNS } from '@helia/ipns'

describe('ipns records', () => {
  let helia: Helia
  let name: IPNS
  let verifiedFetch: VerifiedFetch

  beforeEach(async () => {
    helia = await createHelia()
    name = ipns(helia)
    verifiedFetch = new VerifiedFetch({
      helia
    })
  })

  afterEach(async () => {
    await stop(helia, verifiedFetch)
  })

  it('should support fetching a raw IPNS record', async () => {
    const obj = {
      hello: 'world'
    }
    const c = dagCbor(helia)
    const cid = await c.add(obj)

    const peerId = await createEd25519PeerId()
    const record = await name.publish(peerId, cid)

    const resp = await verifiedFetch.fetch(`ipns://${peerId}`, {
      headers: {
        accept: 'application/vnd.ipfs.ipns-record'
      }
    })
    expect(resp.status).to.equal(200)
    expect(resp.headers.get('content-type')).to.equal('application/vnd.ipfs.ipns-record')

    const buf = new Uint8Array(await resp.arrayBuffer())
    expect(marshal(record)).to.equalBytes(buf)

    const output = unmarshal(buf)
    expect(output.value).to.deep.equal(`/ipfs/${cid}`)
  })

  it('should reject a request for non-IPNS url', async () => {
    const resp = await verifiedFetch.fetch('ipfs://QmbxpRxwKXxnJQjnPqm1kzDJSJ8YgkLxH23mcZURwPHjGv', {
      headers: {
        accept: 'application/vnd.ipfs.ipns-record'
      }
    })
    expect(resp.status).to.equal(400)
  })

  it('should reject a request for a DNSLink url', async () => {
    const resp = await verifiedFetch.fetch('ipns://ipfs.io', {
      headers: {
        accept: 'application/vnd.ipfs.ipns-record'
      }
    })
    expect(resp.status).to.equal(400)
  })

  it('should reject a request for a url with a path component', async () => {
    const obj = {
      hello: 'world'
    }
    const c = dagCbor(helia)
    const cid = await c.add(obj)

    const peerId = await createEd25519PeerId()
    await name.publish(peerId, cid)

    const resp = await verifiedFetch.fetch(`ipns://${peerId}/hello`, {
      headers: {
        accept: 'application/vnd.ipfs.ipns-record'
      }
    })
    expect(resp.status).to.equal(400)
  })
})
