/* eslint-env mocha */
import { dagCbor } from '@helia/dag-cbor'
import { dagJson } from '@helia/dag-json'
import { type IPNS } from '@helia/ipns'
import { json } from '@helia/json'
import { unixfs, type UnixFS } from '@helia/unixfs'
import * as ipldDagCbor from '@ipld/dag-cbor'
import * as ipldDagJson from '@ipld/dag-json'
import { stop } from '@libp2p/interface'
import { defaultLogger } from '@libp2p/logger'
import { expect } from 'aegir/chai'
import last from 'it-last'
import toBuffer from 'it-to-buffer'
import { CID } from 'multiformats/cid'
import * as ipldJson from 'multiformats/codecs/json'
import * as raw from 'multiformats/codecs/raw'
import { identity } from 'multiformats/hashes/identity'
import { sha256 } from 'multiformats/hashes/sha2'
import Sinon from 'sinon'
import { stubInterface } from 'sinon-ts'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { VerifiedFetch } from '../src/verified-fetch.js'
import { createHelia } from './fixtures/create-offline-helia.js'
import type { Helia } from '@helia/interface'
import type { Logger, ComponentLogger } from '@libp2p/interface'

const testCID = CID.parse('QmQJ8fxavY54CUsxMSx9aE9Rdcmvhx8awJK2jzJp4iAqCr')

describe('@helia/verifed-fetch', () => {
  let helia: Helia

  beforeEach(async () => {
    helia = await createHelia()
  })

  afterEach(async () => {
    await stop(helia)
  })

  it('starts and stops the helia node', async () => {
    const helia = stubInterface<Helia>({
      logger: defaultLogger()
    })
    const verifiedFetch = new VerifiedFetch({
      helia
    })

    expect(helia.stop.callCount).to.equal(0)
    expect(helia.start.callCount).to.equal(0)

    await verifiedFetch.start()
    expect(helia.stop.callCount).to.equal(0)
    expect(helia.start.callCount).to.equal(1)

    await verifiedFetch.stop()
    expect(helia.stop.callCount).to.equal(1)
    expect(helia.start.callCount).to.equal(1)
  })

  describe('format not implemented', () => {
    let verifiedFetch: VerifiedFetch

    before(async () => {
      verifiedFetch = new VerifiedFetch({
        helia: stubInterface<Helia>({
          logger: stubInterface<ComponentLogger>({
            forComponent: () => stubInterface<Logger>()
          })
        }),
        ipns: stubInterface<IPNS>({
          resolveDns: async (dnsLink: string) => {
            expect(dnsLink).to.equal('mydomain.com')
            return {
              cid: testCID,
              path: ''
            }
          }
        }),
        unixfs: stubInterface<UnixFS>()
      })
    })

    after(async () => {
      await verifiedFetch.stop()
    })

    const formatsAndAcceptHeaders = [
      ['raw', 'application/vnd.ipld.raw'],
      ['car', 'application/vnd.ipld.car'],
      ['tar', 'application/x-tar'],
      ['dag-json', 'application/vnd.ipld.dag-json'],
      ['dag-cbor', 'application/vnd.ipld.dag-cbor'],
      ['json', 'application/json'],
      ['cbor', 'application/cbor'],
      ['ipns-record', 'application/vnd.ipfs.ipns-record']
    ]

    for (const [format, acceptHeader] of formatsAndAcceptHeaders) {
      // eslint-disable-next-line no-loop-func
      it(`returns 501 for ${acceptHeader}`, async () => {
        const resp = await verifiedFetch.fetch(`ipns://mydomain.com?format=${format}`)
        expect(resp).to.be.ok()
        expect(resp.status).to.equal(501)
        const resp2 = await verifiedFetch.fetch(testCID, {
          headers: {
            accept: acceptHeader
          }
        })
        expect(resp2).to.be.ok()
        expect(resp2.status).to.equal(501)
      })
    }
  })

  describe('implicit format', () => {
    let verifiedFetch: VerifiedFetch

    beforeEach(async () => {
      verifiedFetch = new VerifiedFetch({
        helia
      })
    })

    afterEach(async () => {
      await verifiedFetch.stop()
    })

    it('should return raw data', async () => {
      const finalRootFileContent = new Uint8Array([0x01, 0x02, 0x03])
      const cid = CID.createV1(raw.code, await sha256.digest(finalRootFileContent))
      await helia.blockstore.put(cid, finalRootFileContent)

      const resp = await verifiedFetch.fetch(`ipfs://${cid}`)
      expect(resp).to.be.ok()
      expect(resp.status).to.equal(200)
      expect(resp.statusText).to.equal('OK')
      const data = await resp.arrayBuffer()
      expect(new Uint8Array(data)).to.equalBytes(finalRootFileContent)
    })

    it('should report progress during fetch', async () => {
      const finalRootFileContent = new Uint8Array([0x01, 0x02, 0x03])
      const cid = CID.createV1(raw.code, await sha256.digest(finalRootFileContent))
      await helia.blockstore.put(cid, finalRootFileContent)

      const onProgress = Sinon.spy()

      await verifiedFetch.fetch(`ipfs://${cid}`, {
        onProgress
      })

      expect(onProgress.callCount).to.equal(3)

      const onProgressEvents = onProgress.getCalls().map(call => call.args[0])
      expect(onProgressEvents[0]).to.include({ type: 'blocks:get:blockstore:get' }).and.to.have.property('detail').that.deep.equals(cid)
      expect(onProgressEvents[1]).to.include({ type: 'verified-fetch:request:start' }).and.to.have.property('detail').that.deep.equals({
        cid,
        path: ''
      })
      expect(onProgressEvents[2]).to.include({ type: 'verified-fetch:request:end' }).and.to.have.property('detail').that.deep.equals({
        cid,
        path: ''
      })
    })

    it('should look for index files when directory is returned', async () => {
      const finalRootFileContent = new Uint8Array([0x01, 0x02, 0x03])

      const fs = unixfs(helia)
      const res = await last(fs.addAll([{
        path: 'index.html',
        content: finalRootFileContent
      }], {
        wrapWithDirectory: true
      }))

      if (res == null) {
        throw new Error('Import failed')
      }

      const stat = await fs.stat(res.cid)
      expect(stat.type).to.equal('directory')

      const resp = await verifiedFetch.fetch(res.cid)
      expect(resp).to.be.ok()
      expect(resp.status).to.equal(200)
      expect(resp.statusText).to.equal('OK')

      const data = await resp.arrayBuffer()
      expect(new Uint8Array(data)).to.equalBytes(finalRootFileContent)
    })

    it('should allow use as a stream', async () => {
      const content = new Uint8Array([0x01, 0x02, 0x03])

      const fs = unixfs(helia)
      const cid = await fs.addBytes(content)

      const res = await verifiedFetch.fetch(cid)
      const reader = res.body?.getReader()
      const output: Uint8Array[] = []

      while (true) {
        const next = await reader?.read()

        if (next?.done === true) {
          break
        }

        if (next?.value != null) {
          output.push(next.value)
        }
      }

      expect(toBuffer(output)).to.equalBytes(content)
    })

    it('should return 501 if index file is not found', async () => {
      const finalRootFileContent = new Uint8Array([0x01, 0x02, 0x03])

      const fs = unixfs(helia)
      const res = await last(fs.addAll([{
        path: 'not_an_index.html',
        content: finalRootFileContent
      }], {
        wrapWithDirectory: true
      }))

      if (res == null) {
        throw new Error('Import failed')
      }

      const stat = await fs.stat(res.cid)
      expect(stat.type).to.equal('directory')

      const resp = await verifiedFetch.fetch(res.cid)
      expect(resp).to.be.ok()
      expect(resp.status).to.equal(501)
      expect(resp.statusText).to.equal('Not Implemented')
    })

    it('can round trip json via .json()', async () => {
      const obj = {
        hello: 'world'
      }
      const j = json(helia)
      const cid = await j.add(obj)

      const resp = await verifiedFetch.fetch(cid)
      expect(resp.headers.get('content-type')).to.equal('application/json')

      const output = await resp.json()
      await expect(j.add(output)).to.eventually.deep.equal(cid)
    })

    it('can round trip json via .arrayBuffer()', async () => {
      const obj = {
        hello: 'world'
      }
      const j = json(helia)
      const cid = await j.add(obj)

      const resp = await verifiedFetch.fetch(cid)
      expect(resp.headers.get('content-type')).to.equal('application/json')

      const output = ipldJson.decode(await resp.arrayBuffer())
      await expect(j.add(output)).to.eventually.deep.equal(cid)
    })

    it('should handle dag-json block', async () => {
      const obj = {
        hello: 'world'
      }
      const j = dagJson(helia)
      const cid = await j.add(obj)

      const resp = await verifiedFetch.fetch(cid)
      expect(resp).to.be.ok()
      expect(resp.status).to.equal(200)
      expect(resp.statusText).to.equal('OK')
      expect(resp.headers.get('content-type')).to.equal('application/json')

      await expect(resp.json()).to.eventually.deep.equal(obj)
    })

    it('should return dag-json data with embedded CID', async () => {
      const obj = {
        hello: 'world',
        link: CID.parse('QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN')
      }
      const j = dagJson(helia)
      const cid = await j.add(obj)

      const resp = await verifiedFetch.fetch(cid)
      expect(resp.headers.get('content-type')).to.equal('application/json')

      const data = await resp.json()
      expect(data).to.deep.equal({
        hello: 'world',
        link: {
          '/': 'QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN'
        }
      })
    })

    it('should return dag-json data with embedded bytes', async () => {
      const obj = {
        hello: 'world',
        bytes: Uint8Array.from([0, 1, 2, 3, 4])
      }
      const j = dagJson(helia)
      const cid = await j.add(obj)

      const resp = await verifiedFetch.fetch(cid)
      expect(resp.headers.get('content-type')).to.equal('application/json')

      const data = await resp.json()
      expect(data).to.deep.equal({
        hello: 'world',
        bytes: {
          '/': {
            bytes: 'AAECAwQ'
          }
        }
      })
    })

    it('can round trip dag-json via .json()', async () => {
      const obj = {
        hello: 'world',
        // n.b. cannot round-trip larger than Number.MAX_SAFE_INTEGER because
        // parsing DAG-JSON as using JSON.parse loses precision
        bigInt: 10n,
        link: CID.parse('QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN')
      }
      const j = dagJson(helia)
      const cid = await j.add(obj)

      const resp = await verifiedFetch.fetch(cid)
      expect(resp.headers.get('content-type')).to.equal('application/json')

      const output = await resp.json()
      await expect(j.add(output)).to.eventually.deep.equal(cid)
    })

    it('can round trip dag-json via .arrayBuffer()', async () => {
      const obj = {
        hello: 'world',
        bigInt: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
        link: CID.parse('QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN')
      }
      const j = dagJson(helia)
      const cid = await j.add(obj)

      const resp = await verifiedFetch.fetch(cid)
      expect(resp.headers.get('content-type')).to.equal('application/json')

      const output = ipldDagJson.decode(await resp.arrayBuffer())
      await expect(j.add(output)).to.eventually.deep.equal(cid)
    })

    it('should handle JSON-compliant dag-cbor block', async () => {
      const obj = {
        hello: 'world'
      }
      const c = dagCbor(helia)
      const cid = await c.add(obj)

      const resp = await verifiedFetch.fetch(cid)
      expect(resp).to.be.ok()
      expect(resp.status).to.equal(200)
      expect(resp.statusText).to.equal('OK')
      expect(resp.headers.get('content-type')).to.equal('application/json')
      await expect(resp.json()).to.eventually.deep.equal(obj)
    })

    it('should return dag-cbor data with embedded CID', async () => {
      const obj = {
        hello: 'world',
        link: CID.parse('QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN')
      }
      const c = dagCbor(helia)
      const cid = await c.add(obj)

      const resp = await verifiedFetch.fetch(cid)
      expect(resp.headers.get('content-type')).to.equal('application/octet-stream')

      const data = await ipldDagCbor.decode(await resp.arrayBuffer())
      expect(data).to.deep.equal(obj)
    })

    it('should return dag-cbor data with embedded bytes', async () => {
      const obj = {
        hello: 'world',
        bytes: Uint8Array.from([0, 1, 2, 3, 4])
      }
      const c = dagCbor(helia)
      const cid = await c.add(obj)

      const resp = await verifiedFetch.fetch(cid)
      expect(resp.headers.get('content-type')).to.equal('application/octet-stream')

      const data = await ipldDagCbor.decode(await resp.arrayBuffer())
      expect(data).to.deep.equal(obj)
    })

    it('should allow parsing dag-cbor object array buffer as dag-json', async () => {
      const obj = {
        hello: 'world'
      }
      const c = dagCbor(helia)
      const cid = await c.add(obj)

      const resp = await verifiedFetch.fetch(cid)
      expect(resp.headers.get('content-type')).to.equal('application/json')

      const data = ipldDagJson.decode(await resp.arrayBuffer())
      expect(data).to.deep.equal(obj)
    })

    it('should return dag-cbor with a small BigInt as application/json', async () => {
      const obj = {
        hello: 'world',
        bigInt: 10n
      }
      const c = dagCbor(helia)
      const cid = await c.add(obj)

      const resp = await verifiedFetch.fetch(cid)
      expect(resp.headers.get('content-type')).to.equal('application/json')

      const data = await resp.json()
      expect(data).to.deep.equal({
        hello: 'world',
        bigInt: 10
      })
    })

    it('should return dag-cbor with a large BigInt as application/octet-stream', async () => {
      const obj = {
        hello: 'world',
        bigInt: BigInt(Number.MAX_SAFE_INTEGER) + 1n
      }
      const c = dagCbor(helia)
      const cid = await c.add(obj)

      const resp = await verifiedFetch.fetch(cid)
      expect(resp.headers.get('content-type')).to.equal('application/octet-stream')

      const data = ipldDagCbor.decode(await resp.arrayBuffer())
      expect(data).to.deep.equal(obj)
    })

    it('can round trip JSON-compliant dag-cbor via .json()', async () => {
      const obj = {
        hello: 'world'
      }
      const c = dagCbor(helia)
      const cid = await c.add(obj)

      const resp = await verifiedFetch.fetch(cid)
      expect(resp.headers.get('content-type')).to.equal('application/json')

      const output = await resp.json()
      await expect(c.add(output)).to.eventually.deep.equal(cid)
    })

    // N.b. this is not possible because the incoming block is turned into JSON
    // and returned as the response body, so `.arrayBuffer()` returns a string
    // encoded into a Uint8Array which we can't parse as CBOR
    it.skip('can round trip JSON-compliant dag-cbor via .arrayBuffer()', async () => {
      const obj = {
        hello: 'world'
      }
      const c = dagCbor(helia)
      const cid = await c.add(obj)

      const resp = await verifiedFetch.fetch(cid)
      expect(resp.headers.get('content-type')).to.equal('application/json')

      const output = ipldDagCbor.decode(await resp.arrayBuffer())
      await expect(c.add(output)).to.eventually.deep.equal(cid)
    })

    it('can round trip dag-cbor via .arrayBuffer()', async () => {
      const obj = {
        hello: 'world',
        bigInt: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
        link: CID.parse('QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN')
      }
      const c = dagCbor(helia)
      const cid = await c.add(obj)

      const resp = await verifiedFetch.fetch(cid)
      expect(resp.headers.get('content-type')).to.equal('application/octet-stream')

      const output = ipldDagCbor.decode(await resp.arrayBuffer())
      await expect(c.add(output)).to.eventually.deep.equal(cid)
    })

    it('should handle json block', async () => {
      const obj = {
        hello: 'world'
      }
      const j = json(helia)
      const cid = await j.add(obj)

      const resp = await verifiedFetch.fetch(cid)
      expect(resp).to.be.ok()
      expect(resp.status).to.equal(200)
      expect(resp.statusText).to.equal('OK')
      await expect(resp.json()).to.eventually.deep.equal(obj)
    })

    it('should handle identity CID', async () => {
      const data = uint8ArrayFromString('hello world')
      const cid = CID.createV1(identity.code, identity.digest(data))

      const resp = await verifiedFetch.fetch(cid)
      expect(resp).to.be.ok()
      expect(resp.status).to.equal(200)
      expect(resp.statusText).to.equal('OK')
      await expect(resp.text()).to.eventually.equal('hello world')
    })
  })

  describe('custom dns-resolvers', () => {
    it('uses custom dnsResolvers if provided', async () => {
      const customDnsResolver = Sinon.stub()

      customDnsResolver.returns(Promise.resolve('/ipfs/QmVP2ip92jQuMDezVSzQBWDqWFbp9nyCHNQSiciRauPLDg'))

      const verifiedFetch = new VerifiedFetch({
        helia
      }, {
        dnsResolvers: [customDnsResolver]
      })
      // error of walking the CID/dag because we haven't actually added the block to the blockstore
      await expect(verifiedFetch.fetch('ipns://some-non-cached-domain.com')).to.eventually.be.rejectedWith('All promises were rejected')

      expect(customDnsResolver.callCount).to.equal(1)
      expect(customDnsResolver.getCall(0).args).to.deep.equal(['some-non-cached-domain.com', { onProgress: undefined }])
    })
  })
})
