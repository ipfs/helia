import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import * as raw from 'multiformats/codecs/raw'

/** @type {import('aegir').PartialOptions} */
const options = {
  test: {
    before: async () => {
      // use dynamic import otherwise the source may not have been built yet
      const { createHeliaHTTP } = await import('./dist/src/index.js')

      const heliaHTTP = await createHeliaHTTP()

      const block = Uint8Array.from([0, 1, 2, 3])
      const mh = await sha256.digest(block)
      const cid = CID.createV1(raw.code, mh)
      await heliaHTTP.blockstore.put(cid, block)

      return {
        env: {
          BLOCK_CID: cid.toString()
        },
        heliaHTTP
      }
    },
    after: async (_, beforeResult) => {
      if (beforeResult.heliaHTTP != null) {
        await beforeResult.heliaHTTP.stop()
      }
    }
  }
}

export default options
