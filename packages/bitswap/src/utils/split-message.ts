/* eslint-disable complexity */
import { CodeError } from '@libp2p/interface'
import { encodingLength } from 'uint8-varint'
import { BitswapMessage, Block, BlockPresence, WantlistEntry } from '../pb/message.js'

/**
 * Split the passed Bitswap message into multiple smaller messages that when
 * serialized will be under the maximum message size.
 *
 * Since blocks are the largest thing to send, we first try to fit as many
 * blocks as possible into the message, then add (smaller) block presences and
 * wants until the max size is reached.
 *
 * If a block is encountered that is larger than the max message size an error
 * will be thrown.
 */
export async function * splitMessage (message: BitswapMessage, maxSize: number): AsyncGenerator<Uint8Array> {
  const wantListEntries = message.wantlist?.entries ?? []
  const blockPresences = message.blockPresences
  const blocks = message.blocks

  let wantListIndex = 0
  let blockPresencesIndex = 0
  let blocksIndex = 0
  let messagesSent = 0
  let doneSending = false

  while (true) {
    const subMessage: Required<BitswapMessage> = {
      wantlist: {
        full: false,
        entries: []
      },
      blockPresences: [],
      blocks: [],
      pendingBytes: 0
    }

    let size = 4

    let { added, hasMore, newSize } = addToMessage(blocks, subMessage.blocks, blocksIndex, maxSize, size, calculateEncodedBlockSize)

    blocksIndex += added
    size = newSize
    const haveMoreBlocks = hasMore

    ;({ added, hasMore, newSize } = addToMessage(blockPresences, subMessage.blockPresences, blockPresencesIndex, maxSize, size, calculateEncodedBlockPresenceSize))

    blockPresencesIndex += added
    size = newSize
    const haveMorePresences = hasMore

    ;({ added, hasMore, newSize } = addToMessage(wantListEntries, subMessage.wantlist.entries, wantListIndex, maxSize, size, calculateEncodedWantlistEntrySize))

    wantListIndex += added
    size = newSize
    const haveMoreWantlistEntries = hasMore

    doneSending = !haveMoreBlocks && !haveMorePresences && !haveMoreWantlistEntries

    // if we're only sending one message, and that message has the full wantlist
    // make sure we let the remote know it's the full list
    if (doneSending && messagesSent === 0 && message.wantlist?.full === true) {
      subMessage.wantlist.full = true
    }

    yield BitswapMessage.encode(subMessage)

    messagesSent++

    if (doneSending) {
      break
    }
  }
}

interface AddResult {
  hasMore: boolean
  added: number
  newSize: number
}

function addToMessage <T> (input: T[], output: T[], start: number, maxSize: number, size: number, calculateSize: (arg: T) => number): AddResult {
  let added = 0
  let hasMore = false

  // try to send as many blocks as possible
  for (let i = start; i < input.length; i++) {
    const item = input[i]
    const itemSize = calculateSize(item)

    if (itemSize > maxSize) {
      throw new CodeError('Cannot send block as it is over the max message size', 'ERR_BLOCK_TOO_LARGE')
    }

    const newSize = size + itemSize

    if (newSize >= maxSize) {
      hasMore = true
      break
    }

    output.push(item)
    added++
    size = newSize
  }

  return { hasMore, added, newSize: size }
}

function calculateEncodedBlockSize (block: Block): number {
  // 3 is the "blocks" field number in message.proto
  return calculateLength(3, Block.encode(block))
}

function calculateEncodedBlockPresenceSize (blockPresence: BlockPresence): number {
  // 4 is the "blockPresences" field number in message.proto
  return calculateLength(4, BlockPresence.encode(blockPresence))
}

function calculateEncodedWantlistEntrySize (entry: WantlistEntry): number {
  // 1 is the "entries" field number in message.proto
  return calculateLength(1, WantlistEntry.encode(entry))
}

function calculateLength (fieldNumber: number, data: Uint8Array): number {
  const fieldNumberLength = encodingLength(fieldNumber)
  const dataLengthLength = encodingLength(data.byteLength)

  return fieldNumberLength + dataLengthLength + data.byteLength
}
