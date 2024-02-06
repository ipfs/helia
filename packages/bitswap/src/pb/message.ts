/* eslint-disable import/export */
/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unnecessary-boolean-literal-compare */
/* eslint-disable @typescript-eslint/no-empty-interface */

import { type Codec, decodeMessage, encodeMessage, enumeration, message } from 'protons-runtime'
import { alloc as uint8ArrayAlloc } from 'uint8arrays/alloc'
import type { Uint8ArrayList } from 'uint8arraylist'

export enum WantType {
  WantBlock = 'WantBlock',
  WantHave = 'WantHave'
}

enum __WantTypeValues {
  WantBlock = 0,
  WantHave = 1
}

export namespace WantType {
  export const codec = (): Codec<WantType> => {
    return enumeration<WantType>(__WantTypeValues)
  }
}
export interface WantlistEntry {
  cid: Uint8Array
  priority: number
  cancel?: boolean
  wantType?: WantType
  sendDontHave?: boolean
}

export namespace WantlistEntry {
  let _codec: Codec<WantlistEntry>

  export const codec = (): Codec<WantlistEntry> => {
    if (_codec == null) {
      _codec = message<WantlistEntry>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if ((obj.cid != null && obj.cid.byteLength > 0)) {
          w.uint32(10)
          w.bytes(obj.cid)
        }

        if ((obj.priority != null && obj.priority !== 0)) {
          w.uint32(16)
          w.int32(obj.priority)
        }

        if (obj.cancel != null) {
          w.uint32(24)
          w.bool(obj.cancel)
        }

        if (obj.wantType != null) {
          w.uint32(32)
          WantType.codec().encode(obj.wantType, w)
        }

        if (obj.sendDontHave != null) {
          w.uint32(40)
          w.bool(obj.sendDontHave)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          cid: uint8ArrayAlloc(0),
          priority: 0
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              obj.cid = reader.bytes()
              break
            }
            case 2: {
              obj.priority = reader.int32()
              break
            }
            case 3: {
              obj.cancel = reader.bool()
              break
            }
            case 4: {
              obj.wantType = WantType.codec().decode(reader)
              break
            }
            case 5: {
              obj.sendDontHave = reader.bool()
              break
            }
            default: {
              reader.skipType(tag & 7)
              break
            }
          }
        }

        return obj
      })
    }

    return _codec
  }

  export const encode = (obj: Partial<WantlistEntry>): Uint8Array => {
    return encodeMessage(obj, WantlistEntry.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): WantlistEntry => {
    return decodeMessage(buf, WantlistEntry.codec())
  }
}

export interface Wantlist {
  entries: WantlistEntry[]
  full?: boolean
}

export namespace Wantlist {
  let _codec: Codec<Wantlist>

  export const codec = (): Codec<Wantlist> => {
    if (_codec == null) {
      _codec = message<Wantlist>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (obj.entries != null) {
          for (const value of obj.entries) {
            w.uint32(10)
            WantlistEntry.codec().encode(value, w)
          }
        }

        if (obj.full != null) {
          w.uint32(16)
          w.bool(obj.full)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          entries: []
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              obj.entries.push(WantlistEntry.codec().decode(reader, reader.uint32()))
              break
            }
            case 2: {
              obj.full = reader.bool()
              break
            }
            default: {
              reader.skipType(tag & 7)
              break
            }
          }
        }

        return obj
      })
    }

    return _codec
  }

  export const encode = (obj: Partial<Wantlist>): Uint8Array => {
    return encodeMessage(obj, Wantlist.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): Wantlist => {
    return decodeMessage(buf, Wantlist.codec())
  }
}

export interface Block {
  prefix: Uint8Array
  data: Uint8Array
}

export namespace Block {
  let _codec: Codec<Block>

  export const codec = (): Codec<Block> => {
    if (_codec == null) {
      _codec = message<Block>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if ((obj.prefix != null && obj.prefix.byteLength > 0)) {
          w.uint32(10)
          w.bytes(obj.prefix)
        }

        if ((obj.data != null && obj.data.byteLength > 0)) {
          w.uint32(18)
          w.bytes(obj.data)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          prefix: uint8ArrayAlloc(0),
          data: uint8ArrayAlloc(0)
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              obj.prefix = reader.bytes()
              break
            }
            case 2: {
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
      })
    }

    return _codec
  }

  export const encode = (obj: Partial<Block>): Uint8Array => {
    return encodeMessage(obj, Block.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): Block => {
    return decodeMessage(buf, Block.codec())
  }
}

export enum BlockPresenceType {
  HaveBlock = 'HaveBlock',
  DontHaveBlock = 'DontHaveBlock'
}

enum __BlockPresenceTypeValues {
  HaveBlock = 0,
  DontHaveBlock = 1
}

export namespace BlockPresenceType {
  export const codec = (): Codec<BlockPresenceType> => {
    return enumeration<BlockPresenceType>(__BlockPresenceTypeValues)
  }
}
export interface BlockPresence {
  cid: Uint8Array
  type: BlockPresenceType
}

export namespace BlockPresence {
  let _codec: Codec<BlockPresence>

  export const codec = (): Codec<BlockPresence> => {
    if (_codec == null) {
      _codec = message<BlockPresence>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if ((obj.cid != null && obj.cid.byteLength > 0)) {
          w.uint32(10)
          w.bytes(obj.cid)
        }

        if (obj.type != null && __BlockPresenceTypeValues[obj.type] !== 0) {
          w.uint32(16)
          BlockPresenceType.codec().encode(obj.type, w)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          cid: uint8ArrayAlloc(0),
          type: BlockPresenceType.HaveBlock
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              obj.cid = reader.bytes()
              break
            }
            case 2: {
              obj.type = BlockPresenceType.codec().decode(reader)
              break
            }
            default: {
              reader.skipType(tag & 7)
              break
            }
          }
        }

        return obj
      })
    }

    return _codec
  }

  export const encode = (obj: Partial<BlockPresence>): Uint8Array => {
    return encodeMessage(obj, BlockPresence.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): BlockPresence => {
    return decodeMessage(buf, BlockPresence.codec())
  }
}

export interface BitswapMessage {
  wantlist?: Wantlist
  blocks: Block[]
  blockPresences: BlockPresence[]
  pendingBytes: number
}

export namespace BitswapMessage {
  let _codec: Codec<BitswapMessage>

  export const codec = (): Codec<BitswapMessage> => {
    if (_codec == null) {
      _codec = message<BitswapMessage>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (obj.wantlist != null) {
          w.uint32(10)
          Wantlist.codec().encode(obj.wantlist, w)
        }

        if (obj.blocks != null) {
          for (const value of obj.blocks) {
            w.uint32(26)
            Block.codec().encode(value, w)
          }
        }

        if (obj.blockPresences != null) {
          for (const value of obj.blockPresences) {
            w.uint32(34)
            BlockPresence.codec().encode(value, w)
          }
        }

        if ((obj.pendingBytes != null && obj.pendingBytes !== 0)) {
          w.uint32(40)
          w.int32(obj.pendingBytes)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          blocks: [],
          blockPresences: [],
          pendingBytes: 0
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              obj.wantlist = Wantlist.codec().decode(reader, reader.uint32())
              break
            }
            case 3: {
              obj.blocks.push(Block.codec().decode(reader, reader.uint32()))
              break
            }
            case 4: {
              obj.blockPresences.push(BlockPresence.codec().decode(reader, reader.uint32()))
              break
            }
            case 5: {
              obj.pendingBytes = reader.int32()
              break
            }
            default: {
              reader.skipType(tag & 7)
              break
            }
          }
        }

        return obj
      })
    }

    return _codec
  }

  export const encode = (obj: Partial<BitswapMessage>): Uint8Array => {
    return encodeMessage(obj, BitswapMessage.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): BitswapMessage => {
    return decodeMessage(buf, BitswapMessage.codec())
  }
}
