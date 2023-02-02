/* eslint-disable import/export */
/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unnecessary-boolean-literal-compare */
/* eslint-disable @typescript-eslint/no-empty-interface */

import { encodeMessage, decodeMessage, message } from 'protons-runtime'
import type { Codec } from 'protons-runtime'
import type { Uint8ArrayList } from 'uint8arraylist'

export interface InfoOptions {
  peerId?: string
}

export namespace InfoOptions {
  let _codec: Codec<InfoOptions>

  export const codec = (): Codec<InfoOptions> => {
    if (_codec == null) {
      _codec = message<InfoOptions>((obj, w, opts = {}) => {
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

  export const encode = (obj: Partial<InfoOptions>): Uint8Array => {
    return encodeMessage(obj, InfoOptions.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): InfoOptions => {
    return decodeMessage(buf, InfoOptions.codec())
  }
}

export interface InfoResponse {
  peerId: string
  multiaddrs: string[]
  agentVersion: string
  protocolVersion: string
  protocols: string[]
}

export namespace InfoResponse {
  let _codec: Codec<InfoResponse>

  export const codec = (): Codec<InfoResponse> => {
    if (_codec == null) {
      _codec = message<InfoResponse>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (opts.writeDefaults === true || (obj.peerId != null && obj.peerId !== '')) {
          w.uint32(10)
          w.string(obj.peerId ?? '')
        }

        if (obj.multiaddrs != null) {
          for (const value of obj.multiaddrs) {
            w.uint32(18)
            w.string(value)
          }
        }

        if (opts.writeDefaults === true || (obj.agentVersion != null && obj.agentVersion !== '')) {
          w.uint32(26)
          w.string(obj.agentVersion ?? '')
        }

        if (opts.writeDefaults === true || (obj.protocolVersion != null && obj.protocolVersion !== '')) {
          w.uint32(34)
          w.string(obj.protocolVersion ?? '')
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

  export const encode = (obj: Partial<InfoResponse>): Uint8Array => {
    return encodeMessage(obj, InfoResponse.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): InfoResponse => {
    return decodeMessage(buf, InfoResponse.codec())
  }
}
