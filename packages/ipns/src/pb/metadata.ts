import { decodeMessage, encodeMessage, message } from 'protons-runtime'
import type { Codec, DecodeOptions } from 'protons-runtime'
import type { Uint8ArrayList } from 'uint8arraylist'

export interface IPNSPublishMetadata {
  keyName: string
  lifetime: number
  refresh: boolean
}

export namespace IPNSPublishMetadata {
  let _codec: Codec<IPNSPublishMetadata>

  export const codec = (): Codec<IPNSPublishMetadata> => {
    if (_codec == null) {
      _codec = message<IPNSPublishMetadata>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if ((obj.keyName != null && obj.keyName !== '')) {
          w.uint32(10)
          w.string(obj.keyName)
        }

        if ((obj.lifetime != null && obj.lifetime !== 0)) {
          w.uint32(16)
          w.uint32(obj.lifetime)
        }

        if ((obj.refresh != null && obj.refresh !== false)) {
          w.uint32(16)
          w.bool(obj.refresh)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length, opts = {}) => {
        const obj: any = {
          keyName: '',
          lifetime: 0,
          refresh: false
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              obj.keyName = reader.string()
              break
            }
            case 2: {
              obj.lifetime = reader.uint32()
              break
            }
            case 3: {
              obj.refresh = reader.bool()
              break
            }
            default: {
              reader.skipType(tag & 7)
              break
            }
          }
        }

        return obj
      })
    }

    return _codec
  }

  export const encode = (obj: Partial<IPNSPublishMetadata>): Uint8Array => {
    return encodeMessage(obj, IPNSPublishMetadata.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<IPNSPublishMetadata>): IPNSPublishMetadata => {
    return decodeMessage(buf, IPNSPublishMetadata.codec(), opts)
  }
}
