import { CID } from 'multiformats/cid'
import * as dagPb from '@ipld/dag-pb'
import { sha256 } from 'multiformats/hashes/sha2'
import type { Blocks } from '@helia/interface/blocks'
import type { BlockCodec } from 'multiformats/codecs/interface'
import type { Version as CIDVersion } from 'multiformats/cid'

export interface PersistOptions {
  codec?: BlockCodec<any, any>
  cidVersion: CIDVersion
  signal?: AbortSignal
}

type PutStore = Pick<Blocks, 'put'>

export const persist = async (buffer: Uint8Array, blockstore: PutStore, options: PersistOptions): Promise<CID> => {
  if (options.codec == null) {
    options.codec = dagPb
  }

  const multihash = await sha256.digest(buffer)
  const cid = CID.create(options.cidVersion, options.codec.code, multihash)

  await blockstore.put(cid, buffer, {
    ...options,
    signal: options.signal
  })

  return cid
}
