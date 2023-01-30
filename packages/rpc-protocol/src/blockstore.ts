/* eslint-disable import/export */
/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unnecessary-boolean-literal-compare */
/* eslint-disable @typescript-eslint/no-empty-interface */

import { encodeMessage, decodeMessage, message, enumeration } from 'protons-runtime'
import type { Uint8ArrayList } from 'uint8arraylist'
import type { Codec } from 'protons-runtime'

export interface PutOptions {}

export namespace PutOptions {
  let _codec: Codec<PutOptions>

  export const codec = (): Codec<PutOptions> => {
    if (_codec == null) {
      _codec = message<PutOptions>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {}

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            default:
              reader.skipType(tag & 7)
              break
          }
        }

        return obj
      })
    }

    return _codec
  }

  export const encode = (obj: PutOptions): Uint8Array => {
    return encodeMessage(obj, PutOptions.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): PutOptions => {
    return decodeMessage(buf, PutOptions.codec())
  }
}

export interface PutRequest {
  cid: Uint8Array
  block: Uint8Array
}

export namespace PutRequest {
  let _codec: Codec<PutRequest>

  export const codec = (): Codec<PutRequest> => {
    if (_codec == null) {
      _codec = message<PutRequest>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (opts.writeDefaults === true || (obj.cid != null && obj.cid.byteLength > 0)) {
          w.uint32(10)
          w.bytes(obj.cid)
        }

        if (opts.writeDefaults === true || (obj.block != null && obj.block.byteLength > 0)) {
          w.uint32(18)
          w.bytes(obj.block)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          cid: new Uint8Array(0),
          block: new Uint8Array(0)
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1:
              obj.cid = reader.bytes()
              break
            case 2:
              obj.block = reader.bytes()
              break
            default:
              reader.skipType(tag & 7)
              break
          }
        }

        return obj
      })
    }

    return _codec
  }

  export const encode = (obj: PutRequest): Uint8Array => {
    return encodeMessage(obj, PutRequest.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): PutRequest => {
    return decodeMessage(buf, PutRequest.codec())
  }
}

export interface PutResponse {}

export namespace PutResponse {
  let _codec: Codec<PutResponse>

  export const codec = (): Codec<PutResponse> => {
    if (_codec == null) {
      _codec = message<PutResponse>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {}

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            default:
              reader.skipType(tag & 7)
              break
          }
        }

        return obj
      })
    }

    return _codec
  }

  export const encode = (obj: PutResponse): Uint8Array => {
    return encodeMessage(obj, PutResponse.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): PutResponse => {
    return decodeMessage(buf, PutResponse.codec())
  }
}

export interface GetOptions {}

export namespace GetOptions {
  let _codec: Codec<GetOptions>

  export const codec = (): Codec<GetOptions> => {
    if (_codec == null) {
      _codec = message<GetOptions>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {}

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            default:
              reader.skipType(tag & 7)
              break
          }
        }

        return obj
      })
    }

    return _codec
  }

  export const encode = (obj: GetOptions): Uint8Array => {
    return encodeMessage(obj, GetOptions.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): GetOptions => {
    return decodeMessage(buf, GetOptions.codec())
  }
}

export interface GetRequest {
  cid: Uint8Array
}

export namespace GetRequest {
  let _codec: Codec<GetRequest>

  export const codec = (): Codec<GetRequest> => {
    if (_codec == null) {
      _codec = message<GetRequest>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (opts.writeDefaults === true || (obj.cid != null && obj.cid.byteLength > 0)) {
          w.uint32(10)
          w.bytes(obj.cid)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          cid: new Uint8Array(0)
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1:
              obj.cid = reader.bytes()
              break
            default:
              reader.skipType(tag & 7)
              break
          }
        }

        return obj
      })
    }

    return _codec
  }

  export const encode = (obj: GetRequest): Uint8Array => {
    return encodeMessage(obj, GetRequest.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): GetRequest => {
    return decodeMessage(buf, GetRequest.codec())
  }
}

export enum GetResponseType {
  PROGRESS = 'PROGRESS',
  RESULT = 'RESULT'
}

enum __GetResponseTypeValues {
  PROGRESS = 0,
  RESULT = 1
}

export namespace GetResponseType {
  export const codec = (): Codec<GetResponseType> => {
    return enumeration<GetResponseType>(__GetResponseTypeValues)
  }
}
export interface GetResponse {
  type: GetResponseType
  block?: Uint8Array
  progressEventType?: string
  progressEventData: Map<string, string>
}

export namespace GetResponse {
  export interface GetResponse$progressEventDataEntry {
    key: string
    value: string
  }

  export namespace GetResponse$progressEventDataEntry {
    let _codec: Codec<GetResponse$progressEventDataEntry>

    export const codec = (): Codec<GetResponse$progressEventDataEntry> => {
      if (_codec == null) {
        _codec = message<GetResponse$progressEventDataEntry>((obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork()
          }

          if (opts.writeDefaults === true || obj.key !== '') {
            w.uint32(10)
            w.string(obj.key)
          }

          if (opts.writeDefaults === true || obj.value !== '') {
            w.uint32(18)
            w.string(obj.value)
          }

          if (opts.lengthDelimited !== false) {
            w.ldelim()
          }
        }, (reader, length) => {
          const obj: any = {
            key: '',
            value: ''
          }

          const end = length == null ? reader.len : reader.pos + length

          while (reader.pos < end) {
            const tag = reader.uint32()

            switch (tag >>> 3) {
              case 1:
                obj.key = reader.string()
                break
              case 2:
                obj.value = reader.string()
                break
              default:
                reader.skipType(tag & 7)
                break
            }
          }

          return obj
        })
      }

      return _codec
    }

    export const encode = (obj: GetResponse$progressEventDataEntry): Uint8Array => {
      return encodeMessage(obj, GetResponse$progressEventDataEntry.codec())
    }

    export const decode = (buf: Uint8Array | Uint8ArrayList): GetResponse$progressEventDataEntry => {
      return decodeMessage(buf, GetResponse$progressEventDataEntry.codec())
    }
  }

  let _codec: Codec<GetResponse>

  export const codec = (): Codec<GetResponse> => {
    if (_codec == null) {
      _codec = message<GetResponse>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (opts.writeDefaults === true || (obj.type != null && __GetResponseTypeValues[obj.type] !== 0)) {
          w.uint32(8)
          GetResponseType.codec().encode(obj.type, w)
        }

        if (obj.block != null) {
          w.uint32(18)
          w.bytes(obj.block)
        }

        if (obj.progressEventType != null) {
          w.uint32(26)
          w.string(obj.progressEventType)
        }

        if (obj.progressEventData != null && obj.progressEventData.size !== 0) {
          for (const [key, value] of obj.progressEventData.entries()) {
            w.uint32(34)
            GetResponse.GetResponse$progressEventDataEntry.codec().encode({ key, value }, w, {
              writeDefaults: true
            })
          }
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          type: GetResponseType.PROGRESS,
          progressEventData: new Map<string, string>()
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1:
              obj.type = GetResponseType.codec().decode(reader)
              break
            case 2:
              obj.block = reader.bytes()
              break
            case 3:
              obj.progressEventType = reader.string()
              break
            case 4: {
              const entry = GetResponse.GetResponse$progressEventDataEntry.codec().decode(reader, reader.uint32())
              obj.progressEventData.set(entry.key, entry.value)
              break
            }
            default:
              reader.skipType(tag & 7)
              break
          }
        }

        return obj
      })
    }

    return _codec
  }

  export const encode = (obj: GetResponse): Uint8Array => {
    return encodeMessage(obj, GetResponse.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): GetResponse => {
    return decodeMessage(buf, GetResponse.codec())
  }
}

export interface HasOptions {}

export namespace HasOptions {
  let _codec: Codec<HasOptions>

  export const codec = (): Codec<HasOptions> => {
    if (_codec == null) {
      _codec = message<HasOptions>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {}

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            default:
              reader.skipType(tag & 7)
              break
          }
        }

        return obj
      })
    }

    return _codec
  }

  export const encode = (obj: HasOptions): Uint8Array => {
    return encodeMessage(obj, HasOptions.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): HasOptions => {
    return decodeMessage(buf, HasOptions.codec())
  }
}

export interface HasRequest {
  cid: Uint8Array
}

export namespace HasRequest {
  let _codec: Codec<HasRequest>

  export const codec = (): Codec<HasRequest> => {
    if (_codec == null) {
      _codec = message<HasRequest>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (opts.writeDefaults === true || (obj.cid != null && obj.cid.byteLength > 0)) {
          w.uint32(10)
          w.bytes(obj.cid)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          cid: new Uint8Array(0)
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1:
              obj.cid = reader.bytes()
              break
            default:
              reader.skipType(tag & 7)
              break
          }
        }

        return obj
      })
    }

    return _codec
  }

  export const encode = (obj: HasRequest): Uint8Array => {
    return encodeMessage(obj, HasRequest.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): HasRequest => {
    return decodeMessage(buf, HasRequest.codec())
  }
}

export interface HasResponse {
  has: boolean
}

export namespace HasResponse {
  let _codec: Codec<HasResponse>

  export const codec = (): Codec<HasResponse> => {
    if (_codec == null) {
      _codec = message<HasResponse>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (opts.writeDefaults === true || obj.has !== false) {
          w.uint32(8)
          w.bool(obj.has)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          has: false
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1:
              obj.has = reader.bool()
              break
            default:
              reader.skipType(tag & 7)
              break
          }
        }

        return obj
      })
    }

    return _codec
  }

  export const encode = (obj: HasResponse): Uint8Array => {
    return encodeMessage(obj, HasResponse.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): HasResponse => {
    return decodeMessage(buf, HasResponse.codec())
  }
}

export interface DeleteOptions {}

export namespace DeleteOptions {
  let _codec: Codec<DeleteOptions>

  export const codec = (): Codec<DeleteOptions> => {
    if (_codec == null) {
      _codec = message<DeleteOptions>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {}

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            default:
              reader.skipType(tag & 7)
              break
          }
        }

        return obj
      })
    }

    return _codec
  }

  export const encode = (obj: DeleteOptions): Uint8Array => {
    return encodeMessage(obj, DeleteOptions.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): DeleteOptions => {
    return decodeMessage(buf, DeleteOptions.codec())
  }
}

export interface DeleteRequest {
  cid: Uint8Array
}

export namespace DeleteRequest {
  let _codec: Codec<DeleteRequest>

  export const codec = (): Codec<DeleteRequest> => {
    if (_codec == null) {
      _codec = message<DeleteRequest>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (opts.writeDefaults === true || (obj.cid != null && obj.cid.byteLength > 0)) {
          w.uint32(10)
          w.bytes(obj.cid)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          cid: new Uint8Array(0)
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1:
              obj.cid = reader.bytes()
              break
            default:
              reader.skipType(tag & 7)
              break
          }
        }

        return obj
      })
    }

    return _codec
  }

  export const encode = (obj: DeleteRequest): Uint8Array => {
    return encodeMessage(obj, DeleteRequest.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): DeleteRequest => {
    return decodeMessage(buf, DeleteRequest.codec())
  }
}

export interface DeleteResponse {}

export namespace DeleteResponse {
  let _codec: Codec<DeleteResponse>

  export const codec = (): Codec<DeleteResponse> => {
    if (_codec == null) {
      _codec = message<DeleteResponse>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {}

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            default:
              reader.skipType(tag & 7)
              break
          }
        }

        return obj
      })
    }

    return _codec
  }

  export const encode = (obj: DeleteResponse): Uint8Array => {
    return encodeMessage(obj, DeleteResponse.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): DeleteResponse => {
    return decodeMessage(buf, DeleteResponse.codec())
  }
}
