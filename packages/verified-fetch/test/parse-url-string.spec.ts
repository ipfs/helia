import { type PeerId } from '@libp2p/interface'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { expect } from 'aegir/chai'
import { CID } from 'multiformats/cid'
import { stubInterface } from 'sinon-ts'
import { parseUrlString } from '../src/utils/parse-url-string.js'
import type { IPNS } from '@helia/ipns'

describe('parseUrlString', () => {
  describe('ipfs://<CID> URLs', () => {
    it('can parse a URL with CID only', async () => {
      const ipns = stubInterface<IPNS>({})
      const result = await parseUrlString({
        urlString: 'ipfs://QmQJ8fxavY54CUsxMSx9aE9Rdcmvhx8awJK2jzJp4iAqCr',
        ipns
      })
      expect(result.protocol).to.equal('ipfs')
      expect(result.cid.toString()).to.equal('QmQJ8fxavY54CUsxMSx9aE9Rdcmvhx8awJK2jzJp4iAqCr')
      expect(result.path).to.equal('')
    })
    it('can parse URL with CID+path', async () => {
      const ipns = stubInterface<IPNS>({})
      const result = await parseUrlString({
        urlString: 'ipfs://QmdmQXB2mzChmMeKY47C43LxUdg1NDJ5MWcKMKxDu7RgQm/1 - Barrel - Part 1/1 - Barrel - Part 1 - alt.txt',
        ipns
      })
      expect(result.protocol).to.equal('ipfs')
      expect(result.cid.toString()).to.equal('QmdmQXB2mzChmMeKY47C43LxUdg1NDJ5MWcKMKxDu7RgQm')
      expect(result.path).to.equal('1 - Barrel - Part 1/1 - Barrel - Part 1 - alt.txt')
    })
    it('can parse URL with CID+queryString', async () => {
      const ipns = stubInterface<IPNS>({})
      const result = await parseUrlString({
        urlString: 'ipfs://QmdmQXB2mzChmMeKY47C43LxUdg1NDJ5MWcKMKxDu7RgQm?format=car',
        ipns
      })
      expect(result.protocol).to.equal('ipfs')
      expect(result.cid.toString()).to.equal('QmdmQXB2mzChmMeKY47C43LxUdg1NDJ5MWcKMKxDu7RgQm')
      expect(result.path).to.equal('')
      expect(result.query).to.deep.equal({ format: 'car' })
    })
    it('can parse URL with CID+path+queryString', async () => {
      const ipns = stubInterface<IPNS>({})
      const result = await parseUrlString({
        urlString: 'ipfs://QmdmQXB2mzChmMeKY47C43LxUdg1NDJ5MWcKMKxDu7RgQm/1 - Barrel - Part 1/1 - Barrel - Part 1 - alt.txt?format=tar',
        ipns
      })
      expect(result.protocol).to.equal('ipfs')
      expect(result.cid.toString()).to.equal('QmdmQXB2mzChmMeKY47C43LxUdg1NDJ5MWcKMKxDu7RgQm')
      expect(result.path).to.equal('1 - Barrel - Part 1/1 - Barrel - Part 1 - alt.txt')
      expect(result.query).to.deep.equal({ format: 'tar' })
    })
  })

  describe('ipns://<dnsLinkDomain> URLs', () => {
    let ipns: IPNS
    before(async () => {
      ipns = stubInterface<IPNS>({
        resolveDns: async (dnsLink: string) => {
          expect(dnsLink).to.equal('mydomain.com')
          return CID.parse('QmQJ8fxavY54CUsxMSx9aE9Rdcmvhx8awJK2jzJp4iAqCr')
        }
      })
    })

    it('can parse a URL with DNSLinkDomain only', async () => {
      const result = await parseUrlString({
        urlString: 'ipns://mydomain.com',
        ipns
      })
      expect(result.protocol).to.equal('ipns')
      expect(result.cid.toString()).to.equal('QmQJ8fxavY54CUsxMSx9aE9Rdcmvhx8awJK2jzJp4iAqCr')
      expect(result.path).to.equal('')
    })
    it('can parse a URL with DNSLinkDomain+path', async () => {
      const result = await parseUrlString({
        urlString: 'ipns://mydomain.com/some/path/to/file.txt',
        ipns
      })
      expect(result.protocol).to.equal('ipns')
      expect(result.cid.toString()).to.equal('QmQJ8fxavY54CUsxMSx9aE9Rdcmvhx8awJK2jzJp4iAqCr')
      expect(result.path).to.equal('some/path/to/file.txt')
    })
    it('can parse a URL with DNSLinkDomain+queryString', async () => {
      const result = await parseUrlString({
        urlString: 'ipns://mydomain.com?format=json',
        ipns
      })
      expect(result.protocol).to.equal('ipns')
      expect(result.cid.toString()).to.equal('QmQJ8fxavY54CUsxMSx9aE9Rdcmvhx8awJK2jzJp4iAqCr')
      expect(result.path).to.equal('')
      expect(result.query).to.deep.equal({ format: 'json' })
    })
    it('can parse a URL with DNSLinkDomain+path+queryString', async () => {
      const result = await parseUrlString({
        urlString: 'ipns://mydomain.com/some/path/to/file.txt?format=json',
        ipns
      })
      expect(result.protocol).to.equal('ipns')
      expect(result.cid.toString()).to.equal('QmQJ8fxavY54CUsxMSx9aE9Rdcmvhx8awJK2jzJp4iAqCr')
      expect(result.path).to.equal('some/path/to/file.txt')
      expect(result.query).to.deep.equal({ format: 'json' })
    })
  })

  describe('ipns://<peerId> URLs', () => {
    let ipns: IPNS
    let testPeerId: PeerId
    before(async () => {
      testPeerId = await createEd25519PeerId()
      ipns = stubInterface<IPNS>({
        resolve: async (peerId: PeerId) => {
          expect(peerId.toString()).to.equal(testPeerId.toString())
          return CID.parse('QmQJ8fxavY54CUsxMSx9aE9Rdcmvhx8awJK2jzJp4iAqCr')
        }
      })
    })

    it('can parse a URL with PeerId only', async () => {
      const result = await parseUrlString({
        urlString: `ipns://${testPeerId.toString()}`,
        ipns
      })
      expect(result.protocol).to.equal('ipns')
      expect(result.cid.toString()).to.equal('QmQJ8fxavY54CUsxMSx9aE9Rdcmvhx8awJK2jzJp4iAqCr')
      expect(result.path).to.equal('')
    })
    it('can parse a URL with PeerId+path', async () => {
      const result = await parseUrlString({
        urlString: `ipns://${testPeerId.toString()}/some/path/to/file.txt`,
        ipns
      })
      expect(result.protocol).to.equal('ipns')
      expect(result.cid.toString()).to.equal('QmQJ8fxavY54CUsxMSx9aE9Rdcmvhx8awJK2jzJp4iAqCr')
      expect(result.path).to.equal('some/path/to/file.txt')
    })
    it('can parse a URL with PeerId+queryString', async () => {
      const result = await parseUrlString({
        urlString: `ipns://${testPeerId.toString()}?fomat=dag-cbor`,
        ipns
      })
      expect(result.protocol).to.equal('ipns')
      expect(result.cid.toString()).to.equal('QmQJ8fxavY54CUsxMSx9aE9Rdcmvhx8awJK2jzJp4iAqCr')
      expect(result.path).to.equal('')
      expect(result.query).to.deep.equal({ fomat: 'dag-cbor' })
    })
    it('can parse a URL with PeerId+path+queryString', async () => {
      const result = await parseUrlString({
        urlString: `ipns://${testPeerId.toString()}/some/path/to/file.txt?fomat=dag-cbor`,
        ipns
      })
      expect(result.protocol).to.equal('ipns')
      expect(result.cid.toString()).to.equal('QmQJ8fxavY54CUsxMSx9aE9Rdcmvhx8awJK2jzJp4iAqCr')
      expect(result.path).to.equal('some/path/to/file.txt')
      expect(result.query).to.deep.equal({ fomat: 'dag-cbor' })
    })
  })
})
