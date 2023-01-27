/* eslint-disable import/export */
/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unnecessary-boolean-literal-compare */
/* eslint-disable @typescript-eslint/no-empty-interface */

import { encodeMessage, decodeMessage, message } from 'protons-runtime'
import type { Uint8ArrayList } from 'uint8arraylist'
import type { Codec } from 'protons-runtime'

export interface IdOptions {
  peerId?: string
}

export namespace IdOptions {
  let _codec: Codec<IdOptions>

  export const codec = (): Codec<IdOptions> => {
    if (_codec == null) {
      _codec = message<IdOptions>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (obj.peerId != null) {
          w.uint32(10)
          w.string(obj.peerId)
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
            case 1:
              obj.peerId = reader.string()
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

  export const encode = (obj: IdOptions): Uint8Array => {
    return encodeMessage(obj, IdOptions.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): IdOptions => {
    return decodeMessage(buf, IdOptions.codec())
  }
}

export interface IdResponse {
  peerId: string
  multiaddrs: string[]
  agentVersion: string
  protocolVersion: string
  protocols: string[]
}

export namespace IdResponse {
  let _codec: Codec<IdResponse>

  export const codec = (): Codec<IdResponse> => {
    if (_codec == null) {
      _codec = message<IdResponse>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (opts.writeDefaults === true || obj.peerId !== '') {
          w.uint32(10)
          w.string(obj.peerId)
        }

        if (obj.multiaddrs != null) {
          for (const value of obj.multiaddrs) {
            w.uint32(18)
            w.string(value)
          }
        }

        if (opts.writeDefaults === true || obj.agentVersion !== '') {
          w.uint32(26)
          w.string(obj.agentVersion)
        }

        if (opts.writeDefaults === true || obj.protocolVersion !== '') {
          w.uint32(34)
          w.string(obj.protocolVersion)
        }

        if (obj.protocols != null) {
          for (const value of obj.protocols) {
            w.uint32(42)
            w.string(value)
          }
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          peerId: '',
          multiaddrs: [],
          agentVersion: '',
          protocolVersion: '',
          protocols: []
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1:
              obj.peerId = reader.string()
              break
            case 2:
              obj.multiaddrs.push(reader.string())
              break
            case 3:
              obj.agentVersion = reader.string()
              break
            case 4:
              obj.protocolVersion = reader.string()
              break
            case 5:
              obj.protocols.push(reader.string())
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

  export const encode = (obj: IdResponse): Uint8Array => {
    return encodeMessage(obj, IdResponse.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): IdResponse => {
    return decodeMessage(buf, IdResponse.codec())
  }
}

export interface CatOptions {
  cid: string
  offset: number
  length: number
}

export namespace CatOptions {
  let _codec: Codec<CatOptions>

  export const codec = (): Codec<CatOptions> => {
    if (_codec == null) {
      _codec = message<CatOptions>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (opts.writeDefaults === true || obj.cid !== '') {
          w.uint32(10)
          w.string(obj.cid)
        }

        if (opts.writeDefaults === true || obj.offset !== 0) {
          w.uint32(16)
          w.int32(obj.offset)
        }

        if (opts.writeDefaults === true || obj.length !== 0) {
          w.uint32(24)
          w.int32(obj.length)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          cid: '',
          offset: 0,
          length: 0
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1:
              obj.cid = reader.string()
              break
            case 2:
              obj.offset = reader.int32()
              break
            case 3:
              obj.length = reader.int32()
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

  export const encode = (obj: CatOptions): Uint8Array => {
    return encodeMessage(obj, CatOptions.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): CatOptions => {
    return decodeMessage(buf, CatOptions.codec())
  }
}

export interface CatResponse {
  bytes: Uint8Array
}

export namespace CatResponse {
  let _codec: Codec<CatResponse>

  export const codec = (): Codec<CatResponse> => {
    if (_codec == null) {
      _codec = message<CatResponse>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (opts.writeDefaults === true || (obj.bytes != null && obj.bytes.byteLength > 0)) {
          w.uint32(10)
          w.bytes(obj.bytes)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          bytes: new Uint8Array(0)
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1:
              obj.bytes = reader.bytes()
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

  export const encode = (obj: CatResponse): Uint8Array => {
    return encodeMessage(obj, CatResponse.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): CatResponse => {
    return decodeMessage(buf, CatResponse.codec())
  }
}
