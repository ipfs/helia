import { CID } from 'multiformats/cid'
import * as dagPb from '@ipld/dag-pb'
import { sha256 } from 'multiformats/hashes/sha2'
import type { Blockstore } from 'interface-blockstore'
import type { BlockCodec } from 'multiformats/codecs/interface'
import type { Version as CIDVersion } from 'multiformats/cid'

export interface PersistOptions {
  codec?: BlockCodec<any, any>
  cidVersion: CIDVersion
  signal?: AbortSignal
}

export const persist = async (buffer: Uint8Array, blockstore: Blockstore, options: PersistOptions): Promise<CID> => {
  if (options.codec == null) {
    options.codec = dagPb
  }

  const multihash = await sha256.digest(buffer)
  const cid = CID.create(options.cidVersion, options.codec.code, multihash)

  await blockstore.put(cid, buffer, {
    signal: options.signal
  })

  return cid
}
