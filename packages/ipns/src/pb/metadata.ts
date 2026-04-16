import { decodeMessage, encodeMessage, enumeration, message, streamMessage } from 'protons-runtime'
import type { Codec, DecodeOptions } from 'protons-runtime'
import type { Uint8ArrayList } from 'uint8arraylist'

export enum Upkeep {
  republish = 'republish',
  refresh = 'refresh',
  none = 'none'
}

enum __UpkeepValues {
  republish = 0,
  refresh = 1,
  none = 2
}

export namespace Upkeep {
  export const codec = (): Codec<Upkeep> => {
    return enumeration<Upkeep>(__UpkeepValues)
  }
}

export interface IPNSPublishMetadata {
  keyName: string
  lifetime: number
  upkeep: Upkeep
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

        if (obj.upkeep != null && __UpkeepValues[obj.upkeep] !== 0) {
          w.uint32(24)
          Upkeep.codec().encode(obj.upkeep, w)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length, opts = {}) => {
        const obj: any = {
          keyName: '',
          lifetime: 0,
          upkeep: Upkeep.republish
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
              obj.upkeep = Upkeep.codec().decode(reader)
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
            case 3: {
              yield {
                field: `${prefix}.upkeep`,
                value: Upkeep.codec().decode(reader)
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

  export interface IPNSPublishMetadataUpkeepFieldEvent {
    field: '$.upkeep'
    value: Upkeep
  }

  export function encode (obj: Partial<IPNSPublishMetadata>): Uint8Array {
    return encodeMessage(obj, IPNSPublishMetadata.codec())
  }

  export function decode (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<IPNSPublishMetadata>): IPNSPublishMetadata {
    return decodeMessage(buf, IPNSPublishMetadata.codec(), opts)
  }

  export function stream (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<IPNSPublishMetadata>): Generator<IPNSPublishMetadataKeyNameFieldEvent | IPNSPublishMetadataLifetimeFieldEvent | IPNSPublishMetadataUpkeepFieldEvent> {
    return streamMessage(buf, IPNSPublishMetadata.codec(), opts)
  }
}
