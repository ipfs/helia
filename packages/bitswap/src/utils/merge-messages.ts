import type { QueuedBitswapMessage } from './bitswap-message.js'

export function mergeMessages (existingMessage: QueuedBitswapMessage, newMessage: QueuedBitswapMessage): QueuedBitswapMessage {
  for (const [key, entry] of newMessage.wantlist.entries()) {
    const existingEntry = existingMessage.wantlist.get(key)

    if (existingEntry != null) {
      // take highest priority
      if (existingEntry.priority > entry.priority) {
        entry.priority = existingEntry.priority
      }

      // take later values if passed, otherwise use earlier ones
      entry.cancel = entry.cancel ?? existingEntry.cancel
      entry.wantType = entry.wantType ?? existingEntry.wantType
      entry.sendDontHave = entry.sendDontHave ?? existingEntry.sendDontHave
    }

    existingMessage.wantlist.set(key, entry)
  }

  for (const [key, blockPresence] of newMessage.blockPresences.entries()) {
    // override earlier block presence with later one as if duplicated it is
    // likely to be more accurate since it is more recent
    existingMessage.blockPresences.set(key, blockPresence)
  }

  for (const [key, block] of newMessage.blocks.entries()) {
    existingMessage.blocks.set(key, block)
  }

  if (newMessage.full && !existingMessage.full) {
    existingMessage.full = true
  }

  return existingMessage
}
