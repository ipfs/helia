import { decodeMessage, encodeMessage, enumeration, message, streamMessage } from 'protons-runtime'
import type { Codec, DecodeOptions } from 'protons-runtime'
import type { Uint8ArrayList } from 'uint8arraylist'

export interface IPNSEntry {
  value?: Uint8Array<ArrayBuffer>
  signatureV1?: Uint8Array<ArrayBuffer>
  validityType?: IPNSEntry.ValidityType
  validity?: Uint8Array<ArrayBuffer>
  sequence?: bigint
  ttl?: bigint
  publicKey?: Uint8Array<ArrayBuffer>
  signatureV2?: Uint8Array<ArrayBuffer>
  data?: Uint8Array<ArrayBuffer>
}

export namespace IPNSEntry {
  export enum ValidityType {
    EOL = 'EOL'
  }

  enum __ValidityTypeValues {
    EOL = 0
  }

  export namespace ValidityType {
    export const codec = (): Codec<ValidityType> => {
      return enumeration<ValidityType>(__ValidityTypeValues)
    }
  }

  let _codec: Codec<IPNSEntry>

  export const codec = (): Codec<IPNSEntry> => {
    if (_codec == null) {
      _codec = message<IPNSEntry>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (obj.value != null) {
          w.uint32(10)
          w.bytes(obj.value)
        }

        if (obj.signatureV1 != null) {
          w.uint32(18)
          w.bytes(obj.signatureV1)
        }

        if (obj.validityType != null) {
          w.uint32(24)
          IPNSEntry.ValidityType.codec().encode(obj.validityType, w)
        }

        if (obj.validity != null) {
          w.uint32(34)
          w.bytes(obj.validity)
        }

        if (obj.sequence != null) {
          w.uint32(40)
          w.uint64(obj.sequence)
        }

        if (obj.ttl != null) {
          w.uint32(48)
          w.uint64(obj.ttl)
        }

        if (obj.publicKey != null) {
          w.uint32(58)
          w.bytes(obj.publicKey)
        }

        if (obj.signatureV2 != null) {
          w.uint32(66)
          w.bytes(obj.signatureV2)
        }

        if (obj.data != null) {
          w.uint32(74)
          w.bytes(obj.data)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length, opts = {}) => {
        const obj: any = {}

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              obj.value = reader.bytes()
              break
            }
            case 2: {
              obj.signatureV1 = reader.bytes()
              break
            }
            case 3: {
              obj.validityType = IPNSEntry.ValidityType.codec().decode(reader)
              break
            }
            case 4: {
              obj.validity = reader.bytes()
              break
            }
            case 5: {
              obj.sequence = reader.uint64()
              break
            }
            case 6: {
              obj.ttl = reader.uint64()
              break
            }
            case 7: {
              obj.publicKey = reader.bytes()
              break
            }
            case 8: {
              obj.signatureV2 = reader.bytes()
              break
            }
            case 9: {
              obj.data = reader.bytes()
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
                field: `${prefix}.value`,
                value: reader.bytes()
              }
              break
            }
            case 2: {
              yield {
                field: `${prefix}.signatureV1`,
                value: reader.bytes()
              }
              break
            }
            case 3: {
              yield {
                field: `${prefix}.validityType`,
                value: IPNSEntry.ValidityType.codec().decode(reader)
              }
              break
            }
            case 4: {
              yield {
                field: `${prefix}.validity`,
                value: reader.bytes()
              }
              break
            }
            case 5: {
              yield {
                field: `${prefix}.sequence`,
                value: reader.uint64()
              }
              break
            }
            case 6: {
              yield {
                field: `${prefix}.ttl`,
                value: reader.uint64()
              }
              break
            }
            case 7: {
              yield {
                field: `${prefix}.publicKey`,
                value: reader.bytes()
              }
              break
            }
            case 8: {
              yield {
                field: `${prefix}.signatureV2`,
                value: reader.bytes()
              }
              break
            }
            case 9: {
              yield {
                field: `${prefix}.data`,
                value: reader.bytes()
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

  export interface IPNSEntryValueFieldEvent {
    field: '$.value'
    value: Uint8Array<ArrayBuffer>
  }

  export interface IPNSEntrySignatureV1FieldEvent {
    field: '$.signatureV1'
    value: Uint8Array<ArrayBuffer>
  }

  export interface IPNSEntryValidityTypeFieldEvent {
    field: '$.validityType'
    value: IPNSEntry.ValidityType
  }

  export interface IPNSEntryValidityFieldEvent {
    field: '$.validity'
    value: Uint8Array<ArrayBuffer>
  }

  export interface IPNSEntrySequenceFieldEvent {
    field: '$.sequence'
    value: bigint
  }

  export interface IPNSEntryTtlFieldEvent {
    field: '$.ttl'
    value: bigint
  }

  export interface IPNSEntryPublicKeyFieldEvent {
    field: '$.publicKey'
    value: Uint8Array<ArrayBuffer>
  }

  export interface IPNSEntrySignatureV2FieldEvent {
    field: '$.signatureV2'
    value: Uint8Array<ArrayBuffer>
  }

  export interface IPNSEntryDataFieldEvent {
    field: '$.data'
    value: Uint8Array<ArrayBuffer>
  }

  export function encode (obj: Partial<IPNSEntry>): Uint8Array<ArrayBuffer> {
    return encodeMessage(obj, IPNSEntry.codec())
  }

  export function decode (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<IPNSEntry>): IPNSEntry {
    return decodeMessage(buf, IPNSEntry.codec(), opts)
  }

  export function stream (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<IPNSEntry>): Generator<IPNSEntryValueFieldEvent | IPNSEntrySignatureV1FieldEvent | IPNSEntryValidityTypeFieldEvent | IPNSEntryValidityFieldEvent | IPNSEntrySequenceFieldEvent | IPNSEntryTtlFieldEvent | IPNSEntryPublicKeyFieldEvent | IPNSEntrySignatureV2FieldEvent | IPNSEntryDataFieldEvent> {
    return streamMessage(buf, IPNSEntry.codec(), opts)
  }
}
