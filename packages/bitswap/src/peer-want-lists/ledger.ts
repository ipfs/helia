import toBuffer from 'it-to-buffer'
import { CID } from 'multiformats/cid'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { DEFAULT_MAX_SIZE_REPLACE_HAS_WITH_BLOCK, DEFAULT_DO_NOT_RESEND_BLOCK_WINDOW, DEFAULT_MAX_WANTLIST_SIZE } from '../constants.ts'
import { BlockPresenceType, WantType } from '../pb/message.ts'
import { QueuedBitswapMessage } from '../utils/bitswap-message.ts'
import { cidToPrefix } from '../utils/cid-prefix.ts'
import type { Network } from '../network.ts'
import type { Wantlist } from '../pb/message.ts'
import type { AbortOptions, ComponentLogger, Logger, PeerId } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'

export interface LedgerComponents {
  peerId: PeerId
  blockstore: Blockstore
  network: Network
  logger: ComponentLogger
}

export interface LedgerInit {
  maxSizeReplaceHasWithBlock?: number
  doNotResendBlockWindow?: number
  maxWantListSize?: number
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

  /**
   * If the status is `sending` or `sent`, the block for this CID is or has been
   * sent to the peer so we should not attempt to send it again
   */
  status: 'want' | 'sending' | 'sent'

  /**
   * A timestamp for when this want should be removed from the list, typically
   * this is set with the `sent` status to prevent sending duplicate blocks to a
   * peer. Once it has expired the peer can request the block a subsequent time.
   */
  expires?: number

  /**
   * A timestamp of when this entry was created
   */
  created: number

  /**
   * If this field is false, we have attempted to send this WantList entry but
   * found there is no block for the CID in the blockstore and we are
   * optimistically waiting to see if we come across it later.
   *
   * We only perform the check when we are about to send the block, by which
   * point the entry status is 'sending' so this value with either be false or
   * not set
   */
  haveBlock?: false
}

export class Ledger {
  public peerId: PeerId
  private readonly blockstore: Blockstore
  private readonly network: Network
  private wants: Map<string, PeerWantListEntry>
  public exchangeCount: number
  public bytesSent: number
  public bytesReceived: number
  public lastExchange?: number
  private readonly maxSizeReplaceHasWithBlock: number
  private readonly log: Logger
  private readonly doNotResendBlockWindow: number
  private readonly maxWantListSize: number

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
    this.doNotResendBlockWindow = init.doNotResendBlockWindow ?? DEFAULT_DO_NOT_RESEND_BLOCK_WINDOW
    this.maxWantListSize = init.maxWantListSize ?? DEFAULT_MAX_WANTLIST_SIZE
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

  removeExpiredWants (): void {
    // remove any expired wants
    this.wants.forEach((value, key) => {
      if (value.expires != null && value.expires < Date.now()) {
        this.wants.delete(key)
      }
    })
  }

  public addWants (wantlist?: Wantlist): void {
    if (wantlist == null) {
      return
    }

    // if the message has a full wantlist, remove all entries not currently
    // being sent to the peer
    if (wantlist.full === true) {
      this.wants.forEach((value, key) => {
        if (value.status === 'want') {
          this.wants.delete(key)
        }
      })
    }

    // clear cancelled wants and add new wants to the ledger
    for (const entry of wantlist.entries) {
      const cid = CID.decode(entry.cid)
      const cidStr = uint8ArrayToString(cid.multihash.bytes, 'base64')

      if (entry.cancel === true) {
        this.log('peer %p cancelled want of block for %c', this.peerId, cid)
        this.wants.delete(cidStr)
      } else {
        if (entry.wantType === WantType.WantHave) {
          this.log('peer %p wanted block presence for %c', this.peerId, cid)
        } else {
          this.log('peer %p wanted block for %c', this.peerId, cid)
        }

        const existingWant = this.wants.get(cidStr)

        // we are already tracking a want for this CID, just update the fields
        if (existingWant != null) {
          const sentOrSending = existingWant.status === 'sent' || existingWant.status === 'sending'
          const wantTypeUpgrade = existingWant.wantType === WantType.WantHave && (entry.wantType == null || entry.wantType === WantType.WantBlock)

          // allow upgrade from WantHave to WantBlock if we've previously
          // sent or are sending a WantHave
          if (sentOrSending && wantTypeUpgrade) {
            existingWant.status = 'want'
          }

          existingWant.priority = entry.priority
          existingWant.wantType = entry.wantType ?? WantType.WantBlock
          existingWant.sendDontHave = entry.sendDontHave ?? false
          continue
        }

        // add a new want
        this.wants.set(cidStr, {
          cid,
          priority: entry.priority,
          wantType: entry.wantType ?? WantType.WantBlock,
          sendDontHave: entry.sendDontHave ?? false,
          status: 'want',
          created: Date.now()
        })
      }
    }

    // if we have exceeded maxWantListSize, truncate the list - first select
    // wants that are not currently being sent to the user
    const wants = [...this.wants.entries()]
      .filter(([key, entry]) => entry.status === 'want')

    if (wants.length > this.maxWantListSize) {
      this.truncateWants(wants)
    }
  }

  private truncateWants (wants: Array<[string, PeerWantListEntry]>): void {
    // sort wants by priority, lack of block presence, then age so the wants
    // to be evicted are a older, low priority wants that we don't have the
    // block for
    wants = wants
      .sort((a, b) => {
        if (a[1].created < b[1].created) {
          return -1
        }

        if (b[1].created < a[1].created) {
          return 1
        }

        return 0
      })
      .sort((a, b) => {
        if (a[1].haveBlock === false) {
          return -1
        }

        if (b[1].haveBlock === false) {
          return 1
        }

        return 0
      })
      .sort((a, b) => {
        if (a[1].priority < b[1].priority) {
          return -1
        }

        if (b[1].priority < a[1].priority) {
          return 1
        }

        return 0
      })

    const toRemove = wants.length - this.maxWantListSize

    for (let i = 0; i < toRemove; i++) {
      this.wants.delete(wants[i][0])
    }
  }

  public getWants (): PeerWantListEntry[] {
    return [...this.wants.values()]
  }

  public hasWant (cid: CID): boolean {
    const cidStr = uint8ArrayToString(cid.multihash.bytes, 'base64')

    return this.wants.has(cidStr)
  }

  public async sendBlocksToPeer (options?: AbortOptions): Promise<void> {
    const message = new QueuedBitswapMessage()
    const sentBlocks = new Set<string>()

    // remove any expired wants
    this.removeExpiredWants()

    // pick unsent wants
    const unsent = [...this.wants.entries()]
      .filter(([key, value]) => value.status === 'want')

    // update status, ensure we don't send the same blocks repeatedly
    unsent.forEach(([key, value]) => {
      value.status = 'sending'
    })

    for (const [key, entry] of unsent) {
      try {
        const block = await toBuffer(this.blockstore.get(entry.cid, options))

        // ensure we still need to send the block/status, status may have
        // changed due to incoming message while we were waiting for async block
        // load
        if (entry.status !== 'sending') {
          continue
        }

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

        entry.status = 'sent'
        entry.expires = Date.now() + this.doNotResendBlockWindow
      } catch (err: any) {
        if (err.name !== 'NotFoundError') {
          throw err
        }

        // reset status to try again later
        entry.status = 'want'

        // used to maybe delete this want later if the want list grows too large
        entry.haveBlock = false

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
    }
  }
}
