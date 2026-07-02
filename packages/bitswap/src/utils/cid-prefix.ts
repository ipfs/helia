import ve from './varint-encoder.ts'
import type { CID } from 'multiformats/cid'

export function cidToPrefix (cid: CID): Uint8Array<ArrayBuffer> {
  return ve([
    cid.version, cid.code, cid.multihash.code, cid.multihash.digest.byteLength
  ])
}
