import { DEFAULT_MAX_SIZE_REPLACE_HAS_WITH_BLOCK } from '../constants.js'
import { BlockPresenceType, WantType } from '../pb/message.js'
import { QueuedBitswapMessage } from '../utils/bitswap-message.js'
import { cidToPrefix } from '../utils/cid-prefix.js'
import type { Network } from '../network.js'
import type { AbortOptions, ComponentLogger, Logger, PeerId } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { CID } from 'multiformats/cid'

export interface LedgerComponents {
  peerId: PeerId
  blockstore: Blockstore
  network: Network
  logger: ComponentLogger
}

export interface LedgerInit {
  maxSizeReplaceHasWithBlock?: number
}

export interface PeerWantListEntry {
  /**
   * The CID the peer has requested
   */
  cid: CID

  /**
   * The priority with which the remote should return the block
   */
  priority: number

  /**
   * If we want the block or if we want the remote to tell us if they have the
   * block - note if the block is small they'll send it to us anyway.
   */
  wantType: WantType

  /**
   * Whether the remote should tell us if they have the block or not
   */
  sendDontHave: boolean

  /**
   * If we don't have the block and we've told them we don't have the block
   */
  sentDoNotHave?: boolean
}

export class Ledger {
  public peerId: PeerId
  private readonly blockstore: Blockstore
  private readonly network: Network
  public wants: Map<string, PeerWantListEntry>
  public exchangeCount: number
  public bytesSent: number
  public bytesReceived: number
  public lastExchange?: number
  private readonly maxSizeReplaceHasWithBlock: number
  private readonly log: Logger

  constructor (components: LedgerComponents, init: LedgerInit) {
    this.peerId = components.peerId
    this.blockstore = components.blockstore
    this.network = components.network
    this.wants = new Map()
    this.log = components.logger.forComponent(`helia:bitswap:ledger:${components.peerId}`)

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
    const message = new QueuedBitswapMessage()
    const sentBlocks = new Set<string>()

    for (const [key, entry] of this.wants.entries()) {
      try {
        const block = await this.blockstore.get(entry.cid, options)

        // do they want the block or just us to tell them we have the block
        if (entry.wantType === WantType.WantHave) {
          if (block.byteLength < this.maxSizeReplaceHasWithBlock) {
            this.log('sending have and block for %c', entry.cid)
            // if the block is small we just send it to them
            sentBlocks.add(key)
            message.addBlock(entry.cid, {
              data: block,
              prefix: cidToPrefix(entry.cid)
            })
          } else {
            this.log('sending have for %c', entry.cid)
            // otherwise tell them we have the block
            message.addBlockPresence(entry.cid, {
              cid: entry.cid.bytes,
              type: BlockPresenceType.HaveBlock
            })
          }
        } else {
          this.log('sending block for %c', entry.cid)
          // they want the block, send it to them
          sentBlocks.add(key)
          message.addBlock(entry.cid, {
            data: block,
            prefix: cidToPrefix(entry.cid)
          })
        }
      } catch (err: any) {
        if (err.name !== 'NotFoundError') {
          throw err
        }

        this.log('do not have block for %c', entry.cid)

        // we don't have the requested block and the remote is not interested
        // in us telling them that
        if (!entry.sendDontHave) {
          continue
        }

        // we have already told them we don't have the block
        if (entry.sentDoNotHave === true) {
          continue
        }

        entry.sentDoNotHave = true
        message.addBlockPresence(entry.cid, {
          cid: entry.cid.bytes,
          type: BlockPresenceType.DoNotHaveBlock
        })
      }
    }

    // only send the message if we actually have something to send
    if (message.blocks.size > 0 || message.blockPresences.size > 0) {
      this.log('sending message')
      await this.network.sendMessage(this.peerId, message, options)
      this.log('sent message')

      // update accounting
      this.sentBytes([...message.blocks.values()].reduce((acc, curr) => acc + curr.data.byteLength, 0))

      // remove sent blocks from local copy of their want list - they can still
      // re-request if required
      for (const key of sentBlocks) {
        this.wants.delete(key)
      }
    }
  }
}
