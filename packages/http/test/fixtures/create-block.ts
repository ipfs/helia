import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import type { Blockstore } from 'interface-blockstore'

export async function createBlock <Codec extends number> (codec: Codec, block: Uint8Array): Promise<{ cid: CID<unknown, Codec, 18>, block: Uint8Array }> {
  const mh = await sha256.digest(block)
  const cid = CID.createV1(codec, mh)

  return { cid, block }
}

export async function createAndPutBlock <Codec extends number> (codec: Codec, block: Uint8Array, blockstore: Blockstore): Promise<CID<unknown, Codec, 18>> {
  const result = await createBlock(codec, block)

  await blockstore.put(result.cid, block)

  return result.cid
}
