import { encodingLength } from 'uint8-varint'
import { BlockTooLargeError } from '../errors.js'
import { BitswapMessage, Block, BlockPresence, WantlistEntry } from '../pb/message.js'
import type { QueuedBitswapMessage } from './bitswap-message.js'

/**
 * https://github.com/ipfs/kubo/issues/4473#issuecomment-350390693
 */
export const MAX_BLOCK_SIZE = 4193648
const MAX_ENCODED_BLOCK_SIZE = MAX_BLOCK_SIZE + 16

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
export function * splitMessage (message: QueuedBitswapMessage, maxSize: number): Generator<Uint8Array> {
  const wantListEntries = [...message.wantlist.values()]
  const blockPresences = [...message.blockPresences.values()]
  const blocks = [...message.blocks.values()]

  let wantListIndex = 0
  let blockPresencesIndex = 0
  let blocksIndex = 0
  let doneSending = false

  while (true) {
    const subMessage: Required<BitswapMessage> = {
      wantlist: {
        full: message.full ?? false,
        entries: []
      },
      blockPresences: [],
      blocks: [],
      pendingBytes: 0
    }

    let size = BitswapMessage.encode(subMessage).byteLength

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

    // if we're sending multiple messages this is no longer the full wantlist
    if (!doneSending) {
      subMessage.wantlist.full = false
    }

    yield BitswapMessage.encode(subMessage)

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

    if (itemSize > MAX_ENCODED_BLOCK_SIZE) {
      throw new BlockTooLargeError('Cannot send block as after encoding it is over the max message size')
    }

    const newSize = size + itemSize

    if (newSize > maxSize) {
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
