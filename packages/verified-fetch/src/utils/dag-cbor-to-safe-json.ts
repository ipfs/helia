import * as dagJson from '@ipld/dag-json'
import { decode } from 'cborg'
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
 *
 * This is not as simple as it sounds because `DAG-CBOR` will return `BigInt`s
 * for numbers with a value greater than `Number.MAX_SAFE_INTEGER` - `BigInt`s
 * are not part of JSON so we disable support for them which will cause cborg
 * to throw.
 *
 * `DAG-JSON` uses `Number`s exclusively even though JavaScript cannot safely
 * decode them once they become greater than `Number.MAX_SAFE_INTEGER` so we
 * doubly need to throw when they are encountered which will set the response
 * type as `application/octet-stream` and the user can use `@ipld/dag-cbor` to
 * decode the values in a safe way.
 *
 * `CID`s are re-encoded as `{ "/": "QmFoo" }` and `Uint8Array`s to
 * `{ "/": { "bytes": "base64EncodedBytes" }}` as per the `DAG-JSON` spec.
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
    // because we are about to re-encode to `DAG-JSON` which allows larger
    // numbers than the JS Number type supports so we cause cborg to throw in
    // order to prompt the user to decode using a method that preserves data.
    allowBigInt: false
  })

  return new TextDecoder().decode(dagJson.encode(obj))
}
