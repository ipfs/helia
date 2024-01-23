/* eslint-env mocha */
import { type IPNS } from '@helia/ipns'
import { type UnixFS } from '@helia/unixfs'
import { expect } from 'aegir/chai'
import { CID } from 'multiformats/cid'
import sinon from 'sinon'
import { stubInterface } from 'sinon-ts'
import { VerifiedFetch } from '../src/verified-fetch.js'
import type { Helia } from '@helia/interface'

describe('VerifiedFetch', () => {
  const testCID = CID.parse('QmQJ8fxavY54CUsxMSx9aE9Rdcmvhx8awJK2jzJp4iAqCr')
  describe('Not implemented', () => {
    let verifiedFetch: InstanceType<typeof VerifiedFetch>
    before(async () => {
      verifiedFetch = new VerifiedFetch({
        helia: stubInterface<Helia>(),
        ipns: stubInterface<IPNS>({
          resolveDns: async (dnsLink: string) => {
            expect(dnsLink).to.equal('mydomain.com')
            return testCID
          }
        }),
        unixfs: stubInterface<UnixFS>()
      })
    })
    after(async () => {
      await verifiedFetch.stop()
    })

    const formatsAndAcceptHeaders = [
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
      it(`Returns 501 for ${acceptHeader}`, async () => {
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

  describe('vnd.ipld.raw', () => {
    let verifiedFetch: InstanceType<typeof VerifiedFetch>
    let unixfsStub: ReturnType<typeof stubInterface<UnixFS>>
    beforeEach(async () => {
      unixfsStub = stubInterface<UnixFS>({
        cat: sinon.stub(),
        stat: sinon.stub()
      })
      verifiedFetch = new VerifiedFetch({
        helia: stubInterface<Helia>(),
        ipns: stubInterface<IPNS>(),
        unixfs: unixfsStub
      })
    })
    afterEach(async () => {
      await verifiedFetch.stop()
    })

    it('should return raw data for vnd.ipld.raw', async () => {
      const finalRootFileContent = new Uint8Array([0x01, 0x02, 0x03])
      unixfsStub.stat.returns(Promise.resolve({
        cid: testCID,
        size: 3,
        type: 'raw',
        fileSize: BigInt(3),
        dagSize: BigInt(1),
        localFileSize: BigInt(3),
        localDagSize: BigInt(1),
        blocks: 1
      }))
      unixfsStub.cat.returns({
        [Symbol.asyncIterator]: async function * () {
          yield finalRootFileContent
        }
      })
      const resp = await verifiedFetch.fetch(testCID)
      expect(unixfsStub.stat.called).to.be.true()
      expect(unixfsStub.cat.called).to.be.true()
      expect(resp).to.be.ok()
      expect(resp.status).to.equal(200)
      const data = await resp.arrayBuffer()
      expect(new Uint8Array(data)).to.deep.equal(finalRootFileContent)
    })

    it('should look for root files when directory is returned', async () => {
      const finalRootFileContent = new Uint8Array([0x01, 0x02, 0x03])
      const abortSignal = new AbortController().signal
      // first stat returns a directory
      unixfsStub.stat.onCall(0).returns(Promise.resolve({
        cid: testCID,
        size: 3,
        type: 'directory',
        fileSize: BigInt(3),
        dagSize: BigInt(1),
        localFileSize: BigInt(3),
        localDagSize: BigInt(1),
        blocks: 1
      }))
      // next stat attempts to find root file index.html, let's make it fail 2 times so we can see that it tries the other root files
      unixfsStub.stat.withArgs(testCID, { path: 'index.html', signal: abortSignal }).onCall(0).throws(new Error('not found'))
      unixfsStub.stat.withArgs(testCID, { path: 'index.htm', signal: abortSignal }).onCall(0).throws(new Error('not found'))
      unixfsStub.stat.withArgs(testCID, { path: 'index.shtml', signal: abortSignal }).onCall(0)
        .returns(Promise.resolve({
          cid: CID.parse('Qmc3zqKcwzbbvw3MQm3hXdg8BQoFjGdZiGdAfXAyAGGdLi'),
          size: 3,
          type: 'raw',
          fileSize: BigInt(3),
          dagSize: BigInt(1),
          localFileSize: BigInt(3),
          localDagSize: BigInt(1),
          blocks: 1
        }))
      unixfsStub.cat.returns({
        [Symbol.asyncIterator]: async function * () {
          yield finalRootFileContent
        }
      })
      const resp = await verifiedFetch.fetch(testCID, {
        signal: abortSignal
      })
      expect(unixfsStub.stat.withArgs(testCID).callCount).to.equal(4)
      expect(unixfsStub.stat.withArgs(testCID, { path: 'index.html', signal: abortSignal }).callCount).to.equal(1)
      expect(unixfsStub.stat.withArgs(testCID, { path: 'index.htm', signal: abortSignal }).callCount).to.equal(1)
      expect(unixfsStub.stat.withArgs(testCID, { path: 'index.shtml', signal: abortSignal }).callCount).to.equal(1)
      expect(unixfsStub.cat.withArgs(testCID).callCount).to.equal(0)
      expect(unixfsStub.cat.withArgs(CID.parse('Qmc3zqKcwzbbvw3MQm3hXdg8BQoFjGdZiGdAfXAyAGGdLi')).callCount).to.equal(1)
      expect(resp).to.be.ok()
      expect(resp.status).to.equal(200)
      const data = await resp.arrayBuffer()
      expect(new Uint8Array(data)).to.deep.equal(finalRootFileContent)
    })

    it('should not call unixfs.cat if root file is not found', async () => {
      const abortSignal = new AbortController().signal
      // first stat returns a directory
      unixfsStub.stat.onCall(0).returns(Promise.resolve({
        cid: testCID,
        size: 3,
        type: 'directory',
        fileSize: BigInt(3),
        dagSize: BigInt(1),
        localFileSize: BigInt(3),
        localDagSize: BigInt(1),
        blocks: 1
      }))

      unixfsStub.stat.withArgs(testCID, { path: 'index.html', signal: abortSignal }).onCall(0).throws(new Error('not found'))
      unixfsStub.stat.withArgs(testCID, { path: 'index.htm', signal: abortSignal }).onCall(0).throws(new Error('not found'))
      unixfsStub.stat.withArgs(testCID, { path: 'index.shtml', signal: abortSignal }).onCall(0).throws(new Error('not found'))
      const resp = await verifiedFetch.fetch(testCID, {
        signal: abortSignal
      })
      expect(unixfsStub.stat.withArgs(testCID).callCount).to.equal(4)
      expect(unixfsStub.stat.withArgs(testCID, { path: 'index.html', signal: abortSignal }).callCount).to.equal(1)
      expect(unixfsStub.stat.withArgs(testCID, { path: 'index.htm', signal: abortSignal }).callCount).to.equal(1)
      expect(unixfsStub.stat.withArgs(testCID, { path: 'index.shtml', signal: abortSignal }).callCount).to.equal(1)
      expect(unixfsStub.cat.withArgs(testCID).callCount).to.equal(0)
      expect(resp).to.be.ok()
      expect(resp.status).to.equal(501)
    })
  })
})
