import { type PeerId } from '@libp2p/interface'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { expect } from 'aegir/chai'
import { CID } from 'multiformats/cid'
import { stubInterface } from 'sinon-ts'
import { parseUrlString } from '../src/utils/parse-url-string.js'
import type { IPNS } from '@helia/ipns'

describe('parseUrlString', () => {
  describe('invalid URLs', () => {
    it('throws for invalid URLs', async () => {
      const ipns = stubInterface<IPNS>({})
      try {
        await parseUrlString({
          urlString: 'invalid',
          ipns
        })
        throw new Error('Should have thrown')
      } catch (err) {
        expect((err as Error).message).to.equal('Invalid URL: invalid, please use ipfs:// or ipns:// URLs only.')
      }
    })

    it('throws for invalid protocols', async () => {
      const ipns = stubInterface<IPNS>({})
      try {
        await parseUrlString({
          urlString: 'http://mydomain.com',
          ipns
        })
        throw new Error('Should have thrown')
      } catch (err) {
        expect((err as Error).message).to.equal('Invalid URL: http://mydomain.com, please use ipfs:// or ipns:// URLs only.')
      }
    })

    it('throws an error if resulting CID is invalid', async () => {
      const ipns = stubInterface<IPNS>({
        // @ts-expect-error - purposefully invalid response
        resolveDns: async (_: string) => {
          return null
        }
      })
      try {
        await parseUrlString({
          urlString: 'ipns://mydomain.com',
          ipns
        })
        throw new Error('Should have thrown')
      } catch (err) {
        expect((err as Error).message).to.equal('Invalid resource. Cannot determine CID from URL "ipns://mydomain.com"')
      }
    })
  })

  describe('ipfs://<CID> URLs', () => {
    it('handles invalid CIDs', async () => {
      const ipns = stubInterface<IPNS>({})
      try {
        await parseUrlString({
          urlString: 'ipfs://QmQJ8fxavY54CUsxMSx9aE9Rdcmvhx8awJK2jzJp4i',
          ipns
        })
        throw new Error('Should have thrown')
      } catch (aggErr) {
        expect(aggErr).to.have.property('message', 'Invalid resource. Cannot determine CID from URL "ipfs://QmQJ8fxavY54CUsxMSx9aE9Rdcmvhx8awJK2jzJp4i"')
        expect(aggErr).to.have.property('errors').with.lengthOf(1).that.deep.equals([
          new TypeError('Invalid CID for ipfs://<cid> URL')
        ])
      }
    })

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

    beforeEach(async () => {
      ipns = stubInterface<IPNS>({
        resolveDns: async (dnsLink: string) => {
          expect(dnsLink).to.equal('mydomain.com')
          return {
            cid: CID.parse('QmQJ8fxavY54CUsxMSx9aE9Rdcmvhx8awJK2jzJp4iAqCr'),
            path: ''
          }
        }
      })
    })

    it('handles invalid DNSLinkDomains', async () => {
      ipns = stubInterface<IPNS>({
        resolve: async (peerId: PeerId) => {
          throw new Error('Unexpected failure from ipns resolve method')
        },
        resolveDns: async (_: string) => {
          return Promise.reject(new Error('Unexpected failure from dns query'))
        }
      })

      try {
        await parseUrlString({ urlString: 'ipns://mydomain.com', ipns })
        throw new Error('Should have thrown')
      } catch (aggErr) {
        expect(aggErr).to.have.property('message', 'Invalid resource. Cannot determine CID from URL "ipns://mydomain.com"')
        expect(aggErr).to.have.property('errors').with.lengthOf(2).that.deep.equals([
          new TypeError('Could not parse PeerId in ipns url "mydomain.com", Non-base64 character'),
          new Error('Unexpected failure from dns query')
        ])
      }
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

    beforeEach(async () => {
      testPeerId = await createEd25519PeerId()
      ipns = stubInterface<IPNS>({
        resolve: async (peerId: PeerId) => {
          expect(peerId.toString()).to.equal(testPeerId.toString())
          return {
            cid: CID.parse('QmQJ8fxavY54CUsxMSx9aE9Rdcmvhx8awJK2jzJp4iAqCr'),
            path: ''
          }
        }
      })
    })

    it('handles invalid PeerIds', async () => {
      ipns = stubInterface<IPNS>({
        resolve: async (peerId: PeerId) => {
          throw new Error('Unexpected failure from ipns resolve method')
        },
        resolveDns: async (_: string) => {
          return Promise.reject(new Error('Unexpected failure from dns query'))
        }
      })

      try {
        await parseUrlString({ urlString: 'ipns://123PeerIdIsFake456', ipns })
        throw new Error('Should have thrown')
      } catch (aggErr) {
        expect(aggErr).to.have.property('message', 'Invalid resource. Cannot determine CID from URL "ipns://123PeerIdIsFake456"')
        expect(aggErr).to.have.property('errors').with.lengthOf(2).that.deep.equals([
          new TypeError('Could not parse PeerId in ipns url "123PeerIdIsFake456", Non-base58btc character'),
          new Error('Unexpected failure from dns query')
        ])
      }
    })

    it('handles valid PeerId resolve failures', async () => {
      ipns = stubInterface<IPNS>({
        resolve: async (_: PeerId) => {
          return Promise.reject(new Error('Unexpected failure from ipns resolve method'))
        },
        resolveDns: async (_: string) => {
          return Promise.reject(new Error('Unexpected failure from dns query'))
        }
      })

      // await expect(parseUrlString({ urlString: `ipns://${testPeerId.toString()}`, ipns })).to.eventually.be.rejected()
      //   .with.property('message', `Could not resolve PeerId "${testPeerId.toString()}", Unexpected failure from ipns resolve method`)

      try {
        await parseUrlString({ urlString: `ipns://${testPeerId.toString()}`, ipns })
        throw new Error('Should have thrown')
      } catch (aggErr) {
        expect(aggErr).to.have.property('message', `Invalid resource. Cannot determine CID from URL "ipns://${testPeerId.toString()}"`)
        expect(aggErr).to.have.property('errors').with.lengthOf(2).that.deep.equals([
          new TypeError(`Could not resolve PeerId "${testPeerId.toString()}", Unexpected failure from ipns resolve method`),
          new Error('Unexpected failure from dns query')
        ])
      }
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
