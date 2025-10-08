/* eslint-env mocha */

import { dnsLink } from '@helia/dnslink'
import { expect } from 'aegir/chai'
import { createHeliaNode } from './fixtures/create-helia.js'
import type { DNSLink } from '@helia/dnslink'
import type { DefaultLibp2pServices, Helia } from 'helia'
import type { Libp2p } from 'libp2p'

const TEST_DOMAINS: string[] = [
  'ipfs.tech',
  'docs.ipfs.tech',
  'en.wikipedia-on-ipfs.org'
]

describe('@helia/dnslink', () => {
  let helia: Helia<Libp2p<DefaultLibp2pServices>>
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

      expect(result).to.have.property('cid')
    }).retries(5)
  })
})
