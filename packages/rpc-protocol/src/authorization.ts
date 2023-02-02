/* eslint-disable import/export */
/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unnecessary-boolean-literal-compare */
/* eslint-disable @typescript-eslint/no-empty-interface */

import { encodeMessage, decodeMessage, message } from 'protons-runtime'
import type { Codec } from 'protons-runtime'
import type { Uint8ArrayList } from 'uint8arraylist'

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

  export const encode = (obj: Partial<GetOptions>): Uint8Array => {
    return encodeMessage(obj, GetOptions.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): GetOptions => {
    return decodeMessage(buf, GetOptions.codec())
  }
}

export interface GetRequest {
  user: string
}

export namespace GetRequest {
  let _codec: Codec<GetRequest>

  export const codec = (): Codec<GetRequest> => {
    if (_codec == null) {
      _codec = message<GetRequest>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (opts.writeDefaults === true || (obj.user != null && obj.user !== '')) {
          w.uint32(10)
          w.string(obj.user ?? '')
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          user: ''
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1:
              obj.user = reader.string()
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

  export const encode = (obj: Partial<GetRequest>): Uint8Array => {
    return encodeMessage(obj, GetRequest.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): GetRequest => {
    return decodeMessage(buf, GetRequest.codec())
  }
}

export interface GetResponse {
  authorization: string
}

export namespace GetResponse {
  let _codec: Codec<GetResponse>

  export const codec = (): Codec<GetResponse> => {
    if (_codec == null) {
      _codec = message<GetResponse>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (opts.writeDefaults === true || (obj.authorization != null && obj.authorization !== '')) {
          w.uint32(10)
          w.string(obj.authorization ?? '')
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          authorization: ''
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1:
              obj.authorization = reader.string()
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

  export const encode = (obj: Partial<GetResponse>): Uint8Array => {
    return encodeMessage(obj, GetResponse.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): GetResponse => {
    return decodeMessage(buf, GetResponse.codec())
  }
}
