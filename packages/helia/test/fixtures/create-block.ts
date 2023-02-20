import type { Blockstore } from 'blockstore-core/dist/src/base'
import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'

export async function createBlock <Codec extends number> (codec: Codec, block: Uint8Array, blockstore: Blockstore): Promise<CID<unknown, Codec, 18>> {
  const mh = await sha256.digest(block)
  const cid = CID.createV1(codec, mh)

  await blockstore.put(cid, block)

  return cid
}
