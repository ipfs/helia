import { decodeMessage, encodeMessage, enumeration, MaxLengthError, message, streamMessage } from 'protons-runtime'
import { alloc as uint8ArrayAlloc } from 'uint8arrays/alloc'
import type { Codec, DecodeOptions } from 'protons-runtime'
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
      }, (reader, length, opts = {}) => {
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
      }, function * (reader, length, prefix, opts = {}) {
        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              yield {
                field: `${prefix}.cid`,
                value: reader.bytes()
              }
              break
            }
            case 2: {
              yield {
                field: `${prefix}.priority`,
                value: reader.int32()
              }
              break
            }
            case 3: {
              yield {
                field: `${prefix}.cancel`,
                value: reader.bool()
              }
              break
            }
            case 4: {
              yield {
                field: `${prefix}.wantType`,
                value: WantType.codec().decode(reader)
              }
              break
            }
            case 5: {
              yield {
                field: `${prefix}.sendDontHave`,
                value: reader.bool()
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

  export interface WantlistEntryCidFieldEvent {
    field: '$.cid'
    value: Uint8Array
  }

  export interface WantlistEntryPriorityFieldEvent {
    field: '$.priority'
    value: number
  }

  export interface WantlistEntryCancelFieldEvent {
    field: '$.cancel'
    value: boolean
  }

  export interface WantlistEntryWantTypeFieldEvent {
    field: '$.wantType'
    value: WantType
  }

  export interface WantlistEntrySendDontHaveFieldEvent {
    field: '$.sendDontHave'
    value: boolean
  }

  export function encode (obj: Partial<WantlistEntry>): Uint8Array {
    return encodeMessage(obj, WantlistEntry.codec())
  }

  export function decode (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<WantlistEntry>): WantlistEntry {
    return decodeMessage(buf, WantlistEntry.codec(), opts)
  }

  export function stream (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<WantlistEntry>): Generator<WantlistEntryCidFieldEvent | WantlistEntryPriorityFieldEvent | WantlistEntryCancelFieldEvent | WantlistEntryWantTypeFieldEvent | WantlistEntrySendDontHaveFieldEvent> {
    return streamMessage(buf, WantlistEntry.codec(), opts)
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

        if (obj.entries != null && obj.entries.length > 0) {
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
      }, (reader, length, opts = {}) => {
        const obj: any = {
          entries: []
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              if (opts.limits?.entries != null && obj.entries.length === opts.limits.entries) {
                throw new MaxLengthError('Decode error - repeated field "entries" had too many elements')
              }

              obj.entries.push(WantlistEntry.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.entries$
              }))
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
      }, function * (reader, length, prefix, opts = {}) {
        const obj = {
          entries: 0
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              if (opts.limits?.entries != null && obj.entries === opts.limits.entries) {
                throw new MaxLengthError('Streaming decode error - repeated field "entries" had too many elements')
              }

              for (const evt of WantlistEntry.codec().stream(reader, reader.uint32(), `${prefix}.entries[]`, {
                limits: opts.limits?.entries$
              })) {
                yield {
                  ...evt,
                  index: obj.entries
                }
              }

              obj.entries++

              break
            }
            case 2: {
              yield {
                field: `${prefix}.full`,
                value: reader.bool()
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

  export interface WantlistEntriesCidFieldEvent {
    field: '$.entries[].cid'
    value: Uint8Array
    index: number
  }

  export interface WantlistEntriesPriorityFieldEvent {
    field: '$.entries[].priority'
    value: number
    index: number
  }

  export interface WantlistEntriesCancelFieldEvent {
    field: '$.entries[].cancel'
    value: boolean
    index: number
  }

  export interface WantlistEntriesWantTypeFieldEvent {
    field: '$.entries[].wantType'
    value: WantType
    index: number
  }

  export interface WantlistEntriesSendDontHaveFieldEvent {
    field: '$.entries[].sendDontHave'
    value: boolean
    index: number
  }

  export interface WantlistFullFieldEvent {
    field: '$.full'
    value: boolean
  }

  export function encode (obj: Partial<Wantlist>): Uint8Array {
    return encodeMessage(obj, Wantlist.codec())
  }

  export function decode (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<Wantlist>): Wantlist {
    return decodeMessage(buf, Wantlist.codec(), opts)
  }

  export function stream (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<Wantlist>): Generator<WantlistEntriesCidFieldEvent | WantlistEntriesPriorityFieldEvent | WantlistEntriesCancelFieldEvent | WantlistEntriesWantTypeFieldEvent | WantlistEntriesSendDontHaveFieldEvent | WantlistFullFieldEvent> {
    return streamMessage(buf, Wantlist.codec(), opts)
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
      }, (reader, length, opts = {}) => {
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
      }, function * (reader, length, prefix, opts = {}) {
        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              yield {
                field: `${prefix}.prefix`,
                value: reader.bytes()
              }
              break
            }
            case 2: {
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

  export interface BlockPrefixFieldEvent {
    field: '$.prefix'
    value: Uint8Array
  }

  export interface BlockDataFieldEvent {
    field: '$.data'
    value: Uint8Array
  }

  export function encode (obj: Partial<Block>): Uint8Array {
    return encodeMessage(obj, Block.codec())
  }

  export function decode (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<Block>): Block {
    return decodeMessage(buf, Block.codec(), opts)
  }

  export function stream (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<Block>): Generator<BlockPrefixFieldEvent | BlockDataFieldEvent> {
    return streamMessage(buf, Block.codec(), opts)
  }
}

export enum BlockPresenceType {
  HaveBlock = 'HaveBlock',
  DoNotHaveBlock = 'DoNotHaveBlock'
}

enum __BlockPresenceTypeValues {
  HaveBlock = 0,
  DoNotHaveBlock = 1
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
      }, (reader, length, opts = {}) => {
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
      }, function * (reader, length, prefix, opts = {}) {
        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              yield {
                field: `${prefix}.cid`,
                value: reader.bytes()
              }
              break
            }
            case 2: {
              yield {
                field: `${prefix}.type`,
                value: BlockPresenceType.codec().decode(reader)
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

  export interface BlockPresenceCidFieldEvent {
    field: '$.cid'
    value: Uint8Array
  }

  export interface BlockPresenceTypeFieldEvent {
    field: '$.type'
    value: BlockPresenceType
  }

  export function encode (obj: Partial<BlockPresence>): Uint8Array {
    return encodeMessage(obj, BlockPresence.codec())
  }

  export function decode (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<BlockPresence>): BlockPresence {
    return decodeMessage(buf, BlockPresence.codec(), opts)
  }

  export function stream (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<BlockPresence>): Generator<BlockPresenceCidFieldEvent | BlockPresenceTypeFieldEvent> {
    return streamMessage(buf, BlockPresence.codec(), opts)
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

        if (obj.blocks != null && obj.blocks.length > 0) {
          for (const value of obj.blocks) {
            w.uint32(26)
            Block.codec().encode(value, w)
          }
        }

        if (obj.blockPresences != null && obj.blockPresences.length > 0) {
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
      }, (reader, length, opts = {}) => {
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
              obj.wantlist = Wantlist.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.wantlist
              })
              break
            }
            case 3: {
              if (opts.limits?.blocks != null && obj.blocks.length === opts.limits.blocks) {
                throw new MaxLengthError('Decode error - repeated field "blocks" had too many elements')
              }

              obj.blocks.push(Block.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.blocks$
              }))
              break
            }
            case 4: {
              if (opts.limits?.blockPresences != null && obj.blockPresences.length === opts.limits.blockPresences) {
                throw new MaxLengthError('Decode error - repeated field "blockPresences" had too many elements')
              }

              obj.blockPresences.push(BlockPresence.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.blockPresences$
              }))
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
      }, function * (reader, length, prefix, opts = {}) {
        const obj = {
          blocks: 0,
          blockPresences: 0
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              yield * Wantlist.codec().stream(reader, reader.uint32(), `${prefix}.wantlist`, {
                limits: opts.limits?.wantlist
              })

              break
            }
            case 3: {
              if (opts.limits?.blocks != null && obj.blocks === opts.limits.blocks) {
                throw new MaxLengthError('Streaming decode error - repeated field "blocks" had too many elements')
              }

              for (const evt of Block.codec().stream(reader, reader.uint32(), `${prefix}.blocks[]`, {
                limits: opts.limits?.blocks$
              })) {
                yield {
                  ...evt,
                  index: obj.blocks
                }
              }

              obj.blocks++

              break
            }
            case 4: {
              if (opts.limits?.blockPresences != null && obj.blockPresences === opts.limits.blockPresences) {
                throw new MaxLengthError('Streaming decode error - repeated field "blockPresences" had too many elements')
              }

              for (const evt of BlockPresence.codec().stream(reader, reader.uint32(), `${prefix}.blockPresences[]`, {
                limits: opts.limits?.blockPresences$
              })) {
                yield {
                  ...evt,
                  index: obj.blockPresences
                }
              }

              obj.blockPresences++

              break
            }
            case 5: {
              yield {
                field: `${prefix}.pendingBytes`,
                value: reader.int32()
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

  export interface BitswapMessageWantlistEntriesCidFieldEvent {
    field: '$.wantlist.entries[].cid'
    value: Uint8Array
    index: number
  }

  export interface BitswapMessageWantlistEntriesPriorityFieldEvent {
    field: '$.wantlist.entries[].priority'
    value: number
    index: number
  }

  export interface BitswapMessageWantlistEntriesCancelFieldEvent {
    field: '$.wantlist.entries[].cancel'
    value: boolean
    index: number
  }

  export interface BitswapMessageWantlistEntriesWantTypeFieldEvent {
    field: '$.wantlist.entries[].wantType'
    value: WantType
    index: number
  }

  export interface BitswapMessageWantlistEntriesSendDontHaveFieldEvent {
    field: '$.wantlist.entries[].sendDontHave'
    value: boolean
    index: number
  }

  export interface BitswapMessageWantlistFullFieldEvent {
    field: '$.wantlist.full'
    value: boolean
  }

  export interface BitswapMessageBlocksPrefixFieldEvent {
    field: '$.blocks[].prefix'
    value: Uint8Array
    index: number
  }

  export interface BitswapMessageBlocksDataFieldEvent {
    field: '$.blocks[].data'
    value: Uint8Array
    index: number
  }

  export interface BitswapMessageBlockPresencesCidFieldEvent {
    field: '$.blockPresences[].cid'
    value: Uint8Array
    index: number
  }

  export interface BitswapMessageBlockPresencesTypeFieldEvent {
    field: '$.blockPresences[].type'
    value: BlockPresenceType
    index: number
  }

  export interface BitswapMessagePendingBytesFieldEvent {
    field: '$.pendingBytes'
    value: number
  }

  export function encode (obj: Partial<BitswapMessage>): Uint8Array {
    return encodeMessage(obj, BitswapMessage.codec())
  }

  export function decode (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<BitswapMessage>): BitswapMessage {
    return decodeMessage(buf, BitswapMessage.codec(), opts)
  }

  export function stream (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<BitswapMessage>): Generator<BitswapMessageWantlistEntriesCidFieldEvent | BitswapMessageWantlistEntriesPriorityFieldEvent | BitswapMessageWantlistEntriesCancelFieldEvent | BitswapMessageWantlistEntriesWantTypeFieldEvent | BitswapMessageWantlistEntriesSendDontHaveFieldEvent | BitswapMessageWantlistFullFieldEvent | BitswapMessageBlocksPrefixFieldEvent | BitswapMessageBlocksDataFieldEvent | BitswapMessageBlockPresencesCidFieldEvent | BitswapMessageBlockPresencesTypeFieldEvent | BitswapMessagePendingBytesFieldEvent> {
    return streamMessage(buf, BitswapMessage.codec(), opts)
  }
}
