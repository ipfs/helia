import { CID, Version } from 'multiformats/cid'
import * as dagPB from '@ipld/dag-pb'
import { sha256 } from 'multiformats/hashes/sha2'
import type { BlockCodec } from 'multiformats/codecs/interface'
import type { AbortOptions } from '@libp2p/interfaces'
import type { Blockstore } from 'interface-blockstore'

export interface PersistOptions extends AbortOptions {
  codec?: BlockCodec<any, any>
  cidVersion?: Version
}

export const persist = async (buffer: Uint8Array, blockstore: Blockstore, options: PersistOptions = {}): Promise<CID> => {
  const multihash = await sha256.digest(buffer)
  const cid = CID.create(options.cidVersion ?? 1, dagPB.code, multihash)

  await blockstore.put(cid, buffer, {
    signal: options.signal
  })

  return cid
}
