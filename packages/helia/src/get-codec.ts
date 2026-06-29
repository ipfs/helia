import { UnknownCodecError } from '@helia/interface'
import { isPromise } from '@helia/utils'
import * as dagPb from '@ipld/dag-pb'
import * as raw from 'multiformats/codecs/raw'
import type { CodecLoader } from '@helia/interface'
import type { BlockCodec } from 'multiformats/codecs/interface'

export function getCodec (initialCodecs: Array<BlockCodec<any, any>> = [], loadCodec?: CodecLoader): CodecLoader {
  const codecs: Record<number, BlockCodec<any, any>> = {
    [dagPb.code]: dagPb,
    [raw.code]: raw
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
