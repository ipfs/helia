import * as dagCbor from '@ipld/dag-cbor'
import * as dagPb from '@ipld/dag-pb'
import * as raw from 'multiformats/codecs/raw'
import type { BlockCodec } from 'multiformats'

export function getCodec (code: number): BlockCodec<any, any> {
  if (code === dagPb.code) {
    return dagPb
  }

  if (code === raw.code) {
    return raw
  }

  if (code === dagCbor.code) {
    return dagCbor
  }

  throw new Error(`Unknown codec ${code}`)
}
