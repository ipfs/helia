/* eslint-disable max-depth */
import { DEFAULT_MAX_SIZE_REPLACE_HAS_WITH_BLOCK } from '../constants.js'
import { BlockPresenceType, type BitswapMessage, WantType } from '../pb/message.js'
import { cidToPrefix } from '../utils/cid-prefix.js'
import type { WantListEntry } from '../index.js'
import type { Network } from '../network.js'
import type { PeerId } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { AbortOptions } from 'it-length-prefixed-stream'

export interface LedgerComponents {
  peerId: PeerId
  blockstore: Blockstore
  network: Network
}

export interface LedgerInit {
  maxSizeReplaceHasWithBlock?: number
}

export class Ledger {
  public peerId: PeerId
  private readonly blockstore: Blockstore
  private readonly network: Network
  public wants: Map<string, WantListEntry>
  public exchangeCount: number
  public bytesSent: number
  public bytesReceived: number
  public lastExchange?: number
  private readonly maxSizeReplaceHasWithBlock: number

  constructor (components: LedgerComponents, init: LedgerInit) {
    this.peerId = components.peerId
    this.blockstore = components.blockstore
    this.network = components.network
    this.wants = new Map()

    this.exchangeCount = 0
    this.bytesSent = 0
    this.bytesReceived = 0
    this.maxSizeReplaceHasWithBlock = init.maxSizeReplaceHasWithBlock ?? DEFAULT_MAX_SIZE_REPLACE_HAS_WITH_BLOCK
  }

  sentBytes (n: number): void {
    this.exchangeCount++
    this.lastExchange = (new Date()).getTime()
    this.bytesSent += n
  }

  receivedBytes (n: number): void {
    this.exchangeCount++
    this.lastExchange = (new Date()).getTime()
    this.bytesReceived += n
  }

  debtRatio (): number {
    return (this.bytesSent / (this.bytesReceived + 1)) // +1 is to prevent division by zero
  }

  public async sendBlocksToPeer (options?: AbortOptions): Promise<void> {
    const message: Pick<BitswapMessage, 'blockPresences' | 'blocks'> = {
      blockPresences: [],
      blocks: []
    }
    const sentBlocks = new Set<string>()

    for (const [key, entry] of this.wants.entries()) {
      let block: Uint8Array | undefined
      let has = false

      try {
        block = await this.blockstore.get(entry.cid, options)
        has = true
      } catch (err: any) {
        if (err.code !== 'ERR_NOT_FOUND') {
          throw err
        }
      }

      if (!has) {
        // we don't have the requested block and the remote is not interested
        // in us telling them that
        if (!entry.sendDontHave) {
          continue
        }

        entry.sentDontHave = true
        message.blockPresences.push({
          cid: entry.cid.bytes,
          type: BlockPresenceType.DontHaveBlock
        })

        continue
      }

      if (block != null) {
        // have the requested block
        if (entry.wantType === WantType.WantHave) {
          if (block.byteLength < this.maxSizeReplaceHasWithBlock) {
            // send it anyway
            sentBlocks.add(key)
            message.blocks.push({
              data: block,
              prefix: cidToPrefix(entry.cid)
            })
          } else {
            // tell them we have the block
            message.blockPresences.push({
              cid: entry.cid.bytes,
              type: BlockPresenceType.HaveBlock
            })
          }
        } else {
          // they want the block, send it to them
          sentBlocks.add(key)
          message.blocks.push({
            data: block,
            prefix: cidToPrefix(entry.cid)
          })
        }
      }
    }

    // only send the message if we actually have something to send
    if (message.blocks.length > 0 || message.blockPresences.length > 0) {
      await this.network.sendMessage(this.peerId, message, options)

      // update accounting
      this.sentBytes(message.blocks.reduce((acc, curr) => acc + curr.data.byteLength, 0))

      // remove sent blocks from local copy of their want list - they can still
      // re-request if required
      for (const key of sentBlocks) {
        this.wants.delete(key)
      }
    }
  }
}
