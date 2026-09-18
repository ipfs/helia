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

export interface IPNSEntryInput {
  value?: Uint8Array
  signatureV1?: Uint8Array
  validityType?: IPNSEntry.ValidityType
  validity?: Uint8Array
  sequence?: bigint
  ttl?: bigint
  publicKey?: Uint8Array
  signatureV2?: Uint8Array
  data?: Uint8Array
}

export namespace IPNSEntry {
  export enum ValidityType {
    EOL = 'EOL'
  }

  enum __ValidityTypeValues {
    EOL = 0
  }

  export namespace ValidityType {
    export const codec = (): Codec<ValidityType, ValidityType> => {
      return enumeration<ValidityType>(__ValidityTypeValues)
    }
  }

  let _codec: Codec<IPNSEntry, IPNSEntryInput>

  export const codec = (): Codec<IPNSEntry, IPNSEntryInput> => {
    if (_codec == null) {
      _codec = message<IPNSEntry, IPNSEntryInput>((obj, w, opts = {}) => {
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
      }, (r, length) => {
        const obj: any = {}

        const end = length == null ? r.len : r.pos + length

        while (r.pos < end) {
          const tag = r.uint32()

          switch (tag >>> 3) {
            case 1: {
              obj.value = r.bytes()
              break
            }
            case 2: {
              obj.signatureV1 = r.bytes()
              break
            }
            case 3: {
              obj.validityType = IPNSEntry.ValidityType.codec().decode(r)
              break
            }
            case 4: {
              obj.validity = r.bytes()
              break
            }
            case 5: {
              obj.sequence = r.uint64()
              break
            }
            case 6: {
              obj.ttl = r.uint64()
              break
            }
            case 7: {
              obj.publicKey = r.bytes()
              break
            }
            case 8: {
              obj.signatureV2 = r.bytes()
              break
            }
            case 9: {
              obj.data = r.bytes()
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
            message: 'IPNSEntry'
          }
        }

        while (r.pos < end) {
          const tag = r.uint32()

          switch (tag >>> 3) {
            case 1: {
              yield {
                field: `${prefix}value`,
                value: r.bytes()
              }
              break
            }
            case 2: {
              yield {
                field: `${prefix}signatureV1`,
                value: r.bytes()
              }
              break
            }
            case 3: {
              yield {
                field: `${prefix}validityType`,
                value: IPNSEntry.ValidityType.codec().decode(r)
              }
              break
            }
            case 4: {
              yield {
                field: `${prefix}validity`,
                value: r.bytes()
              }
              break
            }
            case 5: {
              yield {
                field: `${prefix}sequence`,
                value: r.uint64()
              }
              break
            }
            case 6: {
              yield {
                field: `${prefix}ttl`,
                value: r.uint64()
              }
              break
            }
            case 7: {
              yield {
                field: `${prefix}publicKey`,
                value: r.bytes()
              }
              break
            }
            case 8: {
              yield {
                field: `${prefix}signatureV2`,
                value: r.bytes()
              }
              break
            }
            case 9: {
              yield {
                field: `${prefix}data`,
                value: r.bytes()
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
            message: 'IPNSEntry'
          }
        }
      })
    }

    return _codec
  }

  export interface IPNSEntryValueFieldEvent {
    field: '.value'
    value: Uint8Array<ArrayBuffer>
  }

  export interface IPNSEntrySignatureV1FieldEvent {
    field: '.signatureV1'
    value: Uint8Array<ArrayBuffer>
  }

  export interface IPNSEntryValidityTypeFieldEvent {
    field: '.validityType'
    value: IPNSEntry.ValidityType
  }

  export interface IPNSEntryValidityFieldEvent {
    field: '.validity'
    value: Uint8Array<ArrayBuffer>
  }

  export interface IPNSEntrySequenceFieldEvent {
    field: '.sequence'
    value: bigint
  }

  export interface IPNSEntryTtlFieldEvent {
    field: '.ttl'
    value: bigint
  }

  export interface IPNSEntryPublicKeyFieldEvent {
    field: '.publicKey'
    value: Uint8Array<ArrayBuffer>
  }

  export interface IPNSEntrySignatureV2FieldEvent {
    field: '.signatureV2'
    value: Uint8Array<ArrayBuffer>
  }

  export interface IPNSEntryDataFieldEvent {
    field: '.data'
    value: Uint8Array<ArrayBuffer>
  }

  export function encode (obj: IPNSEntryInput): Uint8Array<ArrayBuffer> {
    return encodeMessage(obj, IPNSEntry.codec())
  }

  export function decode (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<IPNSEntry>): IPNSEntry {
    return decodeMessage(buf, IPNSEntry.codec(), opts)
  }

  export function stream (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<IPNSEntry>): Generator<IPNSEntryValueFieldEvent | IPNSEntrySignatureV1FieldEvent | IPNSEntryValidityTypeFieldEvent | IPNSEntryValidityFieldEvent | IPNSEntrySequenceFieldEvent | IPNSEntryTtlFieldEvent | IPNSEntryPublicKeyFieldEvent | IPNSEntrySignatureV2FieldEvent | IPNSEntryDataFieldEvent> {
    return streamMessage(buf, IPNSEntry.codec(), opts)
  }
}
