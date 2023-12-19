/* eslint-env mocha */

// TODO(DJ): TESTS HAVE NOT fully BEEN UPDATED

import { expect } from 'aegir/chai'
import { Key } from 'interface-datastore'
import { CID } from 'multiformats/cid'
import { createHeliaHTTP } from '../src/index.js'
import type { HeliaHTTP } from '@helia/interface/http'

describe('helia factory', () => {
  let heliaHTTP: HeliaHTTP

  afterEach(async () => {
    if (heliaHTTP != null) {
      await heliaHTTP.stop()
    }
  })

  // it('allows creating offline node', async () => {
  //   heliaHTTP = await createHeliaHTTP({
  //     start: false
  //   })

  //   expect(heliaHTTP.libp2p.status).to.equal('stopped')
  // })

  it('does not require any constructor args', async () => {
    heliaHTTP = await createHeliaHTTP()

    const cid = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3F')
    const block = Uint8Array.from([0, 1, 2, 3])
    await heliaHTTP.blockstore.put(cid, block)
    expect(await heliaHTTP.blockstore.has(cid)).to.be.true()

    const key = new Key(`/${cid.toString()}`)
    await heliaHTTP.datastore.put(key, block)
    expect(await heliaHTTP.datastore.has(key)).to.be.true()
  })
})
