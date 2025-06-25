/* eslint-env mocha */

import { ipns } from '@helia/ipns'
import { expect } from 'aegir/chai'
import { createHeliaNode } from './fixtures/create-helia.js'
import type { IPNS } from '@helia/ipns'
import type { DefaultLibp2pServices, Helia } from 'helia'
import type { Libp2p } from 'libp2p'

const TEST_DOMAINS: string[] = [
  'ipfs.tech',
  'docs.ipfs.tech',
  'en.wikipedia-on-ipfs.org'
]

describe('@helia/ipns - dnslink', () => {
  let helia: Helia<Libp2p<DefaultLibp2pServices>>
  let name: IPNS

  beforeEach(async () => {
    helia = await createHeliaNode()
    name = ipns(helia)
  })

  afterEach(async () => {
    if (helia != null) {
      await helia.stop()
    }
  })

  TEST_DOMAINS.forEach(domain => {
    it(`should resolve ${domain}`, async () => {
      const result = await name.resolveDNSLink(domain)

      expect(result).to.have.property('cid')
    }).retries(5)
  })
})
