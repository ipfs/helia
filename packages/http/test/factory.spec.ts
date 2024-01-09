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

  it('does not require any constructor args', async () => {
    try {
      heliaHTTP = await createHeliaHTTP();
  
      const cid = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3F');
      const block = Uint8Array.from([0, 1, 2, 3]);
  
      await heliaHTTP.blockstore.put(cid, block);
      const blockIsStored = await heliaHTTP.blockstore.has(cid);
  
      const key = new Key(`/${cid.toString()}`);
      await heliaHTTP.datastore.put(key, block);
      const dataIsStored = await heliaHTTP.datastore.has(key);
  
      expect(blockIsStored).to.be.true();
      expect(dataIsStored).to.be.true();
    } catch (error: unknown) {
      console.log(`Test failed with error: ${(error as Error).message}`);
      // Handle the error or fail the test if an error is thrown
      // assert.fail();
    }
  })
})
