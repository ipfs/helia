import { decode } from 'cborg'
import { encode } from 'cborg/json'
import { CID } from 'multiformats/cid'
import type { TagDecoder } from 'cborg'

// https://github.com/ipfs/go-ipfs/issues/3570#issuecomment-273931692
const CID_CBOR_TAG = 0x2A

function cidDecoder (bytes: Uint8Array): CID {
  if (bytes[0] !== 0) {
    throw new Error('Invalid CID for CBOR tag 42; expected leading 0x00')
  }

  return CID.decode(bytes.subarray(1)) // ignore leading 0x00
}

/**
 * Take a `DAG-CBOR` encoded `Uint8Array`, deserialize it as an object and
 * re-serialize it in a form that can be passed to `JSON.serialize` and then
 * `JSON.parse` without losing any data.
 */
export function dagCborToSafeJSON (buf: Uint8Array): string {
  const tags: TagDecoder[] = []
  tags[CID_CBOR_TAG] = cidDecoder

  const obj = decode(buf, {
    allowIndefinite: false,
    coerceUndefinedToNull: true,
    allowNaN: false,
    allowInfinity: false,
    strict: true,
    useMaps: false,
    rejectDuplicateMapKeys: true,
    tags,

    // this is different to `DAG-CBOR` - the reason we disallow BigInts is
    // because we are about to re-encode to `JSON` which does not support
    // BigInts. Blocks containing large numbers should be deserialized using a
    // cbor decoder instead
    allowBigInt: false
  })

  return new TextDecoder().decode(encode(obj))
}
