import { decodeMessage, encodeMessage, message, streamMessage } from 'protons-runtime'
import type { Codec, DecodeOptions } from 'protons-runtime'
import type { Uint8ArrayList } from 'uint8arraylist'

export interface IPNSPublishMetadata {
  keyName: string
  lifetime: number
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

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length, opts = {}) => {
        const obj: any = {
          keyName: '',
          lifetime: 0
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
            default: {
              reader.skipType(tag & 7)
              break
            }
          }
        }

        return obj
      }, function * (reader, length, prefix, opts = {}) {
        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              yield {
                field: `${prefix}.keyName`,
                value: reader.string()
              }
              break
            }
            case 2: {
              yield {
                field: `${prefix}.lifetime`,
                value: reader.uint32()
              }
              break
            }
            default: {
              reader.skipType(tag & 7)
              break
            }
          }
        }
      })
    }

    return _codec
  }

  export interface IPNSPublishMetadataKeyNameFieldEvent {
    field: '$.keyName'
    value: string
  }

  export interface IPNSPublishMetadataLifetimeFieldEvent {
    field: '$.lifetime'
    value: number
  }

  export function encode (obj: Partial<IPNSPublishMetadata>): Uint8Array {
    return encodeMessage(obj, IPNSPublishMetadata.codec())
  }

  export function decode (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<IPNSPublishMetadata>): IPNSPublishMetadata {
    return decodeMessage(buf, IPNSPublishMetadata.codec(), opts)
  }

  export function stream (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<IPNSPublishMetadata>): Generator<IPNSPublishMetadataKeyNameFieldEvent | IPNSPublishMetadataLifetimeFieldEvent> {
    return streamMessage(buf, IPNSPublishMetadata.codec(), opts)
  }
}
