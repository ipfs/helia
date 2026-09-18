import { decodeMessage, encodeMessage, enumeration, message, streamMessage } from 'protons-runtime'
import type { Codec, DecodeOptions } from 'protons-runtime'
import type { Uint8ArrayList } from 'uint8arraylist'

export enum Upkeep {
  reissue = 'reissue',
  rebroadcast = 'rebroadcast',
  none = 'none'
}

enum __UpkeepValues {
  reissue = 0,
  rebroadcast = 1,
  none = 2
}

export namespace Upkeep {
  export const codec = (): Codec<Upkeep, Upkeep> => {
    return enumeration<Upkeep>(__UpkeepValues)
  }
}

export interface IPNSPublishMetadata {
  keyName: string
  lifetime: number
  upkeep: Upkeep
}

export interface IPNSPublishMetadataInput {
  keyName?: string
  lifetime?: number
  upkeep?: Upkeep
}

export namespace IPNSPublishMetadata {
  let _codec: Codec<IPNSPublishMetadata, IPNSPublishMetadataInput>

  export const codec = (): Codec<IPNSPublishMetadata, IPNSPublishMetadataInput> => {
    if (_codec == null) {
      _codec = message<IPNSPublishMetadata, IPNSPublishMetadataInput>((obj, w, opts = {}) => {
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
      }, (r, length) => {
        const obj: any = {
          keyName: '',
          lifetime: 0,
          upkeep: Upkeep.reissue
        }

        const end = length == null ? r.len : r.pos + length

        while (r.pos < end) {
          const tag = r.uint32()

          switch (tag >>> 3) {
            case 1: {
              obj.keyName = r.string()
              break
            }
            case 2: {
              obj.lifetime = r.uint32()
              break
            }
            case 3: {
              obj.upkeep = Upkeep.codec().decode(r)
              break
            }
            default: {
              r.skipType(tag & 7)
              break
            }
          }
        }

        return obj
      }, function * (r, length, prefix) {
        const end = length == null ? r.len : r.pos + length

        if (prefix !== '.') {
          yield {
            field: prefix.endsWith('.') ? prefix.substring(0, prefix.length - 1) : prefix,
            type: 'start',
            message: 'IPNSPublishMetadata'
          }
        }

        while (r.pos < end) {
          const tag = r.uint32()

          switch (tag >>> 3) {
            case 1: {
              yield {
                field: `${prefix}keyName`,
                value: r.string()
              }
              break
            }
            case 2: {
              yield {
                field: `${prefix}lifetime`,
                value: r.uint32()
              }
              break
            }
            case 3: {
              yield {
                field: `${prefix}upkeep`,
                value: Upkeep.codec().decode(r)
              }
              break
            }
            default: {
              r.skipType(tag & 7)
              break
            }
          }
        }

        if (prefix !== '.') {
          yield {
            field: prefix.endsWith('.') ? prefix.substring(0, prefix.length - 1) : prefix,
            type: 'end',
            message: 'IPNSPublishMetadata'
          }
        }
      })
    }

    return _codec
  }

  export interface IPNSPublishMetadataKeyNameFieldEvent {
    field: '.keyName'
    value: string
  }

  export interface IPNSPublishMetadataLifetimeFieldEvent {
    field: '.lifetime'
    value: number
  }

  export interface IPNSPublishMetadataUpkeepFieldEvent {
    field: '.upkeep'
    value: Upkeep
  }

  export function encode (obj: IPNSPublishMetadataInput): Uint8Array<ArrayBuffer> {
    return encodeMessage(obj, IPNSPublishMetadata.codec())
  }

  export function decode (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<IPNSPublishMetadata>): IPNSPublishMetadata {
    return decodeMessage(buf, IPNSPublishMetadata.codec(), opts)
  }

  export function stream (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<IPNSPublishMetadata>): Generator<IPNSPublishMetadataKeyNameFieldEvent | IPNSPublishMetadataLifetimeFieldEvent | IPNSPublishMetadataUpkeepFieldEvent> {
    return streamMessage(buf, IPNSPublishMetadata.codec(), opts)
  }
}
