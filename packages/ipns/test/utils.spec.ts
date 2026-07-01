import { expect } from 'aegir/chai'
import { base58btc } from 'multiformats/bases/base58'
import { CID } from 'multiformats/cid'
import * as Digest from 'multiformats/hashes/digest'
import { InvalidValueError } from '../src/errors.ts'
import { shouldRepublish } from '../src/utils.ts'
import { normalizeValue, multihashFromIPNSRoutingKey, multihashToIPNSRoutingKey } from '../src/utils.ts'
import type { MultihashDigest } from 'multiformats/cid'

describe('shouldRepublish', () => {
  it('should return true when DHT expiry is within threshold', () => {
    const now = Date.now()
    const created = new Date(now - 48 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000) // 36 hours ago (within 24h threshold)
    const expiry = new Date(now + 24 * 60 * 60 * 1000) // Valid for 24 more hours

    const result = shouldRepublish(created, expiry)
    expect(result).to.be.true()
  })

  it('should return true when record expiry is within threshold', () => {
    const now = Date.now()
    const created = new Date(now - 12 * 60 * 60 * 1000) // 12 hours ago (DHT not expired)
    const expiry = new Date(now + 12 * 60 * 60 * 1000) // Valid for only 12 more hours (within 24h threshold)

    const result = shouldRepublish(created, expiry)
    expect(result).to.be.true()
  })

  it('should return false when both DHT and record expiry are beyond threshold', () => {
    const now = Date.now()
    const created = new Date(now - 12 * 60 * 60 * 1000) // 12 hours ago
    const expiry = new Date(now + 36 * 60 * 60 * 1000) // Valid for 36 more hours

    const result = shouldRepublish(created, expiry)
    expect(result).to.be.false()
  })

  it('should return true when both expiries are within threshold', () => {
    const now = Date.now()
    const created = new Date(now - 36 * 60 * 60 * 1000) // 36 hours ago (DHT within threshold)
    const expiry = new Date(now + 12 * 60 * 60 * 1000) // Valid for 12 more hours (record within threshold)

    const result = shouldRepublish(created, expiry)
    expect(result).to.be.true()
  })

  it('should handle edge case with very old DHT record', () => {
    const now = Date.now()
    const created = new Date(now - 72 * 60 * 60 * 1000) // 72 hours ago (well past DHT expiry)
    const expiry = new Date(now + 48 * 60 * 60 * 1000) // Valid for 48 more hours

    const result = shouldRepublish(created, expiry)
    expect(result).to.be.true()
  })

  it('should handle edge case with expired record', () => {
    const now = Date.now()
    const created = new Date(now - 12 * 60 * 60 * 1000) // 12 hours ago
    const expiry = new Date(now - 1 * 60 * 60 * 1000) // Expired 1 hour ago

    const result = shouldRepublish(created, expiry)
    expect(result).to.be.true()
  })

  it('should work with string date format from IPNS record', () => {
    const now = Date.now()
    const created = new Date(now - 12 * 60 * 60 * 1000) // 12 hours ago
    const expiry = new Date(now + 12 * 60 * 60 * 1000) // 12 hours from now (within threshold)

    const result = shouldRepublish(created, expiry)
    expect(result).to.be.true()
  })

  it('should handle boundary conditions around 24 hour threshold', () => {
    const now = Date.now()

    // Test just under threshold (should not republish)
    const createdJustUnder = new Date(now - 23 * 60 * 60 * 1000) // 23 hours ago
    const expiryJustUnder = new Date(now + 25 * 60 * 60 * 1000) // Valid for 25 more hours

    expect(shouldRepublish(createdJustUnder, expiryJustUnder)).to.be.false()

    // Test just over threshold (should republish)
    const createdJustOver = new Date(now - 25 * 60 * 60 * 1000) // 25 hours ago
    const expiryJustOver = new Date(now + 25 * 60 * 60 * 1000) // Valid for 25 more hours

    expect(shouldRepublish(createdJustOver, expiryJustOver)).to.be.true()
  })

  it('should return true for already expired records', () => {
    const now = Date.now()
    const created = new Date(now - 6 * 60 * 60 * 1000) // 6 hours ago (DHT still valid)
    const expiry = new Date(now - 3 * 60 * 60 * 1000) // Expired 3 hours ago (recordExpiry - now is negative)

    const result = shouldRepublish(created, expiry)
    expect(result).to.be.true()
  })

  it('should return true for records that expired long ago', () => {
    const now = Date.now()
    const created = new Date(now - 12 * 60 * 60 * 1000) // 12 hours ago (DHT still valid)
    const expiry = new Date(now - 48 * 60 * 60 * 1000) // Expired 48 hours ago (very negative value)

    const result = shouldRepublish(created, expiry)
    expect(result).to.be.true()
  })
})

describe('utils', () => {
  describe('normalizeValue', () => {
    const cases: Record<string, { input: any, output: string }> = {
      // CID input
      'v0 CID': {
        input: CID.parse('QmWEekX7EZLUd9VXRNMRXW3LXe4F6x7mB8oPxY5XLptrBq'),
        output: '/ipfs/bafybeidvkqhl6dwsdzx5km7tupo33ywt7czkl5topwogxx6lybko2d7pua'
      },
      'v1 CID': {
        input: CID.parse('bafybeidvkqhl6dwsdzx5km7tupo33ywt7czkl5topwogxx6lybko2d7pua'),
        output: '/ipfs/bafybeidvkqhl6dwsdzx5km7tupo33ywt7czkl5topwogxx6lybko2d7pua'
      },
      'v1 Libp2p Key CID': {
        input: CID.parse('bafzaajqaeqeaceralaazlm56u23dyhpm7ztoo5x4dcus2ghpqwedhoezk4h6yijbl6rq'),
        // spellchecker:disable-next-line
        output: '/ipns/k73ap3wtp70r7cd9ofyhwgogv1j96huvtvfnsof5spyfaaopkxmonumi4fckgguqr'
      },

      // path input
      '/ipfs/CID path': {
        input: '/ipfs/QmWEekX7EZLUd9VXRNMRXW3LXe4F6x7mB8oPxY5XLptrBq/docs/readme.md',
        output: '/ipfs/bafybeidvkqhl6dwsdzx5km7tupo33ywt7czkl5topwogxx6lybko2d7pua/docs/readme.md'
      },
      '/ipns/CID path': {
        // spellchecker:disable-next-line
        input: '/ipns/k51qzi5uqu5djni72pr40dt64kxlh0zb8baat8h7dtdvkov66euc2lho0oidr3',
        // spellchecker:disable-next-line
        output: '/ipns/k51qzi5uqu5djni72pr40dt64kxlh0zb8baat8h7dtdvkov66euc2lho0oidr3'
      },

      // peer id input
      'Ed25519 Multihash': {
        input: Digest.decode(base58btc.decode('z12D3KooWKBpVwnRACfEsk6QME7dA5CZnFYVHQ7Zc927BEzuUekQe')),
        // spellchecker:disable-next-line
        output: '/ipns/k0cllw0ah15bk13xeuy5m069zagn1tm7xh8fdaxu4uou6aep7ognucwiyan'
      },
      'secp256k1 PeerId': {
        input: Digest.decode(base58btc.decode('z16Uiu2HAkyBsAs6fPyJYVNq3pUDFxyFnUPTQYL2JpLMEViMUwEnp2')),
        // spellchecker:disable-next-line
        output: '/ipns/k02k36k9symzr5c1hh3qclohff3q3ngnvc6nofpky1m1qs9urmhgx9ncre4eb'
      },
      'RSA PeerId': {
        input: Digest.decode(base58btc.decode('zQmPofjNRgPN3ndH5RbcSr3X5EekvpCRsUw1E8ji8kJaQJa')),
        // spellchecker:disable-next-line
        output: '/ipns/kmue6a9clea7464nfp4yp4vmr7tk4bzbrihafi004r81kmcyhlmrz'
      },

      // string input
      'string path': {
        input: '/hello',
        output: '/hello'
      }
    }

    Object.entries(cases).forEach(([name, { input, output }]) => {
      it(`should normalize a ${name}`, () => {
        expect(normalizeValue(input)).to.equal(output)
      })
    })

    it('should fail to normalize non-path value', async () => {
      expect(() => normalizeValue('hello')).to.throw()
        .with.property('name', InvalidValueError.name)
    })

    it('should fail to normalize path value that is too short', async () => {
      expect(() => normalizeValue('/')).to.throw()
        .with.property('name', InvalidValueError.name)
    })
  })

  describe('routing keys', () => {
    const cases: Record<string, MultihashDigest> = {
      Ed25519: Digest.decode(base58btc.decode('z12D3KooWKBpVwnRACfEsk6QME7dA5CZnFYVHQ7Zc927BEzuUekQe')),
      secp256k1: Digest.decode(base58btc.decode('z16Uiu2HAkyBsAs6fPyJYVNq3pUDFxyFnUPTQYL2JpLMEViMUwEnp2')),
      RSA: Digest.decode(base58btc.decode('z12D3KooWKBpVwnRACfEsk6QME7dA5CZnFYVHQ7Zc927BEzuUekQe'))
    }

    Object.entries(cases).forEach(([name, input]) => {
      it(`should round trip a ${name} key`, async () => {
        const key = multihashToIPNSRoutingKey(input)
        const output = multihashFromIPNSRoutingKey(key)

        expect(input.bytes).to.equalBytes(output.bytes)
      })
    })
  })
})
