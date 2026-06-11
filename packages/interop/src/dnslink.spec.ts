import { dnsLink } from '@helia/dnslink'
import { expect } from 'aegir/chai'
import { createHeliaNode } from './fixtures/create-helia.ts'
import type { DNSLink } from '@helia/dnslink'
import type { HeliaWithLibp2p } from '@helia/libp2p'

const TEST_DOMAINS: string[] = [
  'ipfs.tech',
  'docs.ipfs.tech',
  'en.wikipedia-on-ipfs.org'
]

describe('@helia/dnslink', () => {
  let helia: HeliaWithLibp2p
  let name: DNSLink

  beforeEach(async () => {
    helia = await createHeliaNode()
    name = dnsLink(helia)
  })

  afterEach(async () => {
    if (helia != null) {
      await helia.stop()
    }
  })

  TEST_DOMAINS.forEach(domain => {
    it(`should resolve ${domain}`, async () => {
      const result = await name.resolve(domain)

      expect(result).to.have.nested.property('[0].cid')
    }).retries(5)
  })
})
