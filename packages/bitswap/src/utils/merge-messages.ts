import { base64 } from 'multiformats/bases/base64'
import type { BitswapMessage, Block, BlockPresence, WantlistEntry } from '../pb/message.js'

export function mergeMessages (messageA: BitswapMessage, messageB: BitswapMessage): BitswapMessage {
  const wantListEntries = new Map<string, WantlistEntry>(
    (messageA.wantlist?.entries ?? []).map(entry => ([
      base64.encode(entry.cid),
      entry
    ]))
  )

  for (const entry of messageB.wantlist?.entries ?? []) {
    const key = base64.encode(entry.cid)
    const existingEntry = wantListEntries.get(key)

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

    wantListEntries.set(key, entry)
  }

  const blockPresences = new Map<string, BlockPresence>(
    messageA.blockPresences.map(presence => ([
      base64.encode(presence.cid),
      presence
    ]))
  )

  for (const blockPresence of messageB.blockPresences) {
    const key = base64.encode(blockPresence.cid)

    // override earlier block presence with later one as if duplicated it is
    // likely to be more accurate since it is more recent
    blockPresences.set(key, blockPresence)
  }

  const blocks = new Map<string, Block>(
    messageA.blocks.map(block => ([
      base64.encode(block.data),
      block
    ]))
  )

  for (const block of messageB.blocks) {
    const key = base64.encode(block.data)

    blocks.set(key, block)
  }

  const output: BitswapMessage = {
    wantlist: {
      full: messageA.wantlist?.full ?? messageB.wantlist?.full ?? false,
      entries: [...wantListEntries.values()]
    },
    blockPresences: [...blockPresences.values()],
    blocks: [...blocks.values()],
    pendingBytes: messageA.pendingBytes + messageB.pendingBytes
  }

  return output
}
