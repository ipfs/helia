/* eslint-env mocha */

import { ipns } from '@helia/ipns'
import { createHeliaNode } from './fixtures/create-helia.js'
import type { IPNS } from '@helia/ipns'
import type { HeliaLibp2p } from 'helia'

describe.only('@helia/ipns - dnslink', () => {
  let helia: HeliaLibp2p
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

  it('should resolve ipfs.io', async () => {
    const result = await name.resolveDns('ipfs.io')

    console.info(result)
  })
})
