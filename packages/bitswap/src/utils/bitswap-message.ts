import { base64 } from 'multiformats/bases/base64'
import type { Block, BlockPresence, WantlistEntry } from '../pb/message.js'
import type { CID } from 'multiformats'

/**
 * A bitswap message that is in the send queue. So implemented to be
 * cheap to merge multiple messages when we repeatedly send messages
 * to the same peer.
 */
export class QueuedBitswapMessage {
  public full: boolean
  public pendingBytes: number
  public wantlist: Map<string, WantlistEntry>
  public blocks: Map<string, Block>
  public blockPresences: Map<string, BlockPresence>

  constructor (full: boolean = false, pendingBytes: number = 0) {
    this.full = full
    this.wantlist = new Map()
    this.blocks = new Map()
    this.blockPresences = new Map()
    this.pendingBytes = 0
  }

  addWantlistEntry (cid: CID, entry: WantlistEntry): void {
    const key = base64.encode(cid.multihash.bytes)
    this.wantlist.set(key, entry)
  }

  addBlockPresence (cid: CID, blockPresence: BlockPresence): void {
    const key = base64.encode(cid.multihash.bytes)
    this.blockPresences.set(key, blockPresence)
  }

  addBlock (cid: CID, block: Block): void {
    const key = base64.encode(cid.multihash.bytes)
    this.blocks.set(key, block)
  }
}
