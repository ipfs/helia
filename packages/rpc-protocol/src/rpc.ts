/* eslint-disable import/export */
/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unnecessary-boolean-literal-compare */
/* eslint-disable @typescript-eslint/no-empty-interface */

import { encodeMessage, decodeMessage, message, enumeration } from 'protons-runtime'
import type { Codec } from 'protons-runtime'
import type { Uint8ArrayList } from 'uint8arraylist'

export interface RPCCallRequest {
  resource: string
  method: string
  authorization: string
  options: Uint8Array
}

export namespace RPCCallRequest {
  let _codec: Codec<RPCCallRequest>

  export const codec = (): Codec<RPCCallRequest> => {
    if (_codec == null) {
      _codec = message<RPCCallRequest>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (opts.writeDefaults === true || (obj.resource != null && obj.resource !== '')) {
          w.uint32(10)
          w.string(obj.resource ?? '')
        }

        if (opts.writeDefaults === true || (obj.method != null && obj.method !== '')) {
          w.uint32(18)
          w.string(obj.method ?? '')
        }

        if (opts.writeDefaults === true || (obj.authorization != null && obj.authorization !== '')) {
          w.uint32(26)
          w.string(obj.authorization ?? '')
        }

        if (opts.writeDefaults === true || (obj.options != null && obj.options.byteLength > 0)) {
          w.uint32(34)
          w.bytes(obj.options ?? new Uint8Array(0))
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          resource: '',
          method: '',
          authorization: '',
          options: new Uint8Array(0)
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1:
              obj.resource = reader.string()
              break
            case 2:
              obj.method = reader.string()
              break
            case 3:
              obj.authorization = reader.string()
              break
            case 4:
              obj.options = reader.bytes()
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

  export const encode = (obj: Partial<RPCCallRequest>): Uint8Array => {
    return encodeMessage(obj, RPCCallRequest.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): RPCCallRequest => {
    return decodeMessage(buf, RPCCallRequest.codec())
  }
}

export enum RPCCallMessageType {
  RPC_CALL_DONE = 'RPC_CALL_DONE',
  RPC_CALL_ERROR = 'RPC_CALL_ERROR',
  RPC_CALL_MESSAGE = 'RPC_CALL_MESSAGE',
  RPC_CALL_PROGRESS = 'RPC_CALL_PROGRESS'
}

enum __RPCCallMessageTypeValues {
  RPC_CALL_DONE = 0,
  RPC_CALL_ERROR = 1,
  RPC_CALL_MESSAGE = 2,
  RPC_CALL_PROGRESS = 3
}

export namespace RPCCallMessageType {
  export const codec = (): Codec<RPCCallMessageType> => {
    return enumeration<RPCCallMessageType>(__RPCCallMessageTypeValues)
  }
}
export interface RPCCallMessage {
  type: RPCCallMessageType
  message: Uint8Array
}

export namespace RPCCallMessage {
  let _codec: Codec<RPCCallMessage>

  export const codec = (): Codec<RPCCallMessage> => {
    if (_codec == null) {
      _codec = message<RPCCallMessage>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (opts.writeDefaults === true || (obj.type != null && __RPCCallMessageTypeValues[obj.type] !== 0)) {
          w.uint32(8)
          RPCCallMessageType.codec().encode(obj.type ?? RPCCallMessageType.RPC_CALL_DONE, w)
        }

        if (opts.writeDefaults === true || (obj.message != null && obj.message.byteLength > 0)) {
          w.uint32(18)
          w.bytes(obj.message ?? new Uint8Array(0))
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          type: RPCCallMessageType.RPC_CALL_DONE,
          message: new Uint8Array(0)
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1:
              obj.type = RPCCallMessageType.codec().decode(reader)
              break
            case 2:
              obj.message = reader.bytes()
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

  export const encode = (obj: Partial<RPCCallMessage>): Uint8Array => {
    return encodeMessage(obj, RPCCallMessage.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): RPCCallMessage => {
    return decodeMessage(buf, RPCCallMessage.codec())
  }
}

export interface RPCCallError {
  name?: string
  message?: string
  stack?: string
  code?: string
}

export namespace RPCCallError {
  let _codec: Codec<RPCCallError>

  export const codec = (): Codec<RPCCallError> => {
    if (_codec == null) {
      _codec = message<RPCCallError>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (obj.name != null) {
          w.uint32(10)
          w.string(obj.name)
        }

        if (obj.message != null) {
          w.uint32(18)
          w.string(obj.message)
        }

        if (obj.stack != null) {
          w.uint32(26)
          w.string(obj.stack)
        }

        if (obj.code != null) {
          w.uint32(34)
          w.string(obj.code)
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
              obj.name = reader.string()
              break
            case 2:
              obj.message = reader.string()
              break
            case 3:
              obj.stack = reader.string()
              break
            case 4:
              obj.code = reader.string()
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

  export const encode = (obj: Partial<RPCCallError>): Uint8Array => {
    return encodeMessage(obj, RPCCallError.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): RPCCallError => {
    return decodeMessage(buf, RPCCallError.codec())
  }
}

export interface RPCCallProgress {
  event: string
  data: Map<string, string>
}

export namespace RPCCallProgress {
  export interface RPCCallProgress$dataEntry {
    key: string
    value: string
  }

  export namespace RPCCallProgress$dataEntry {
    let _codec: Codec<RPCCallProgress$dataEntry>

    export const codec = (): Codec<RPCCallProgress$dataEntry> => {
      if (_codec == null) {
        _codec = message<RPCCallProgress$dataEntry>((obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork()
          }

          if (opts.writeDefaults === true || (obj.key != null && obj.key !== '')) {
            w.uint32(10)
            w.string(obj.key ?? '')
          }

          if (opts.writeDefaults === true || (obj.value != null && obj.value !== '')) {
            w.uint32(18)
            w.string(obj.value ?? '')
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

    export const encode = (obj: Partial<RPCCallProgress$dataEntry>): Uint8Array => {
      return encodeMessage(obj, RPCCallProgress$dataEntry.codec())
    }

    export const decode = (buf: Uint8Array | Uint8ArrayList): RPCCallProgress$dataEntry => {
      return decodeMessage(buf, RPCCallProgress$dataEntry.codec())
    }
  }

  let _codec: Codec<RPCCallProgress>

  export const codec = (): Codec<RPCCallProgress> => {
    if (_codec == null) {
      _codec = message<RPCCallProgress>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (opts.writeDefaults === true || (obj.event != null && obj.event !== '')) {
          w.uint32(10)
          w.string(obj.event ?? '')
        }

        if (obj.data != null && obj.data.size !== 0) {
          for (const [key, value] of obj.data.entries()) {
            w.uint32(34)
            RPCCallProgress.RPCCallProgress$dataEntry.codec().encode({ key, value }, w, {
              writeDefaults: true
            })
          }
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          event: '',
          data: new Map<string, string>()
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1:
              obj.event = reader.string()
              break
            case 4: {
              const entry = RPCCallProgress.RPCCallProgress$dataEntry.codec().decode(reader, reader.uint32())
              obj.data.set(entry.key, entry.value)
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

  export const encode = (obj: Partial<RPCCallProgress>): Uint8Array => {
    return encodeMessage(obj, RPCCallProgress.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): RPCCallProgress => {
    return decodeMessage(buf, RPCCallProgress.codec())
  }
}
