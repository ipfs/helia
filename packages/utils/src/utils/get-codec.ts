/* eslint max-depth: ["error", 7] */

import { UnknownCodecError } from '@helia/interface'
import * as dagCbor from '@ipld/dag-cbor'
import * as dagJson from '@ipld/dag-json'
import * as dagPb from '@ipld/dag-pb'
import * as json from 'multiformats/codecs/json'
import * as raw from 'multiformats/codecs/raw'
import { isPromise } from './is-promise.js'
import type { Await } from '@helia/interface'
import type { BlockCodec } from 'multiformats/codecs/interface'

export function getCodec <T = any, Code extends number = any> (initialCodecs: Array<BlockCodec<any, any>> = [], loadCodec?: (code: number) => Await<BlockCodec<any, any>>): (code: Code) => Await<BlockCodec<Code, T>> {
  const codecs: Record<number, BlockCodec<any, any>> = {
    [dagPb.code]: dagPb,
    [raw.code]: raw,
    [dagCbor.code]: dagCbor,
    [dagJson.code]: dagJson,
    [json.code]: json
  }

  initialCodecs.forEach(codec => {
    codecs[codec.code] = codec
  })

  return async (code) => {
    let codec = codecs[code]

    if (codec == null && loadCodec != null) {
      const res = loadCodec(code)

      if (isPromise(res)) {
        codec = await res
      } else {
        codec = res
      }

      codecs[codec.code] = codec
    }

    if (codec != null) {
      return codec
    }

    throw new UnknownCodecError(`Could not load codec for ${code}`)
  }
}
