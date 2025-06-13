import { trackedPeerMap } from '@libp2p/peer-collections'
import { CID } from 'multiformats/cid'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { WantType } from '../pb/message.js'
import { Ledger } from './ledger.js'
import type { BitswapNotifyProgressEvents, WantListEntry } from '../index.js'
import type { Network } from '../network.js'
import type { BitswapMessage } from '../pb/message.js'
import type { AbortOptions, ComponentLogger, Libp2p, Logger, Metrics, PeerId } from '@libp2p/interface'
import type { PeerMap } from '@libp2p/peer-collections'
import type { Blockstore } from 'interface-blockstore'
import type { ProgressOptions } from 'progress-events'

export interface PeerWantListsInit {
  maxSizeReplaceHasWithBlock?: number
}

export interface PeerWantListsComponents {
  blockstore: Blockstore
  network: Network
  libp2p: Libp2p
  logger: ComponentLogger
  metrics?: Metrics
}

export interface PeerLedger {
  peer: PeerId
  value: number
  sent: number
  received: number
  exchanged: number
}

export class PeerWantLists {
  public blockstore: Blockstore
  public network: Network
  public readonly ledgerMap: PeerMap<Ledger>
  private readonly maxSizeReplaceHasWithBlock?: number
  private readonly log: Logger
  private readonly logger: ComponentLogger

  constructor (components: PeerWantListsComponents, init: PeerWantListsInit = {}) {
    this.blockstore = components.blockstore
    this.network = components.network
    this.maxSizeReplaceHasWithBlock = init.maxSizeReplaceHasWithBlock
    this.log = components.logger.forComponent('helia:bitswap:peer-want-lists')
    this.logger = components.logger

    this.ledgerMap = trackedPeerMap({
      name: 'helia_bitswap_ledger_map',
      metrics: components.metrics
    })

    this.network.addEventListener('bitswap:message', (evt) => {
      this.receiveMessage(evt.detail.peer, evt.detail.message)
        .catch(err => {
          this.log.error('error receiving bitswap message from %p', evt.detail.peer, err)
        })
    })
    this.network.addEventListener('peer:disconnected', evt => {
      this.peerDisconnected(evt.detail)
    })
  }

  ledgerForPeer (peerId: PeerId): PeerLedger | undefined {
    const ledger = this.ledgerMap.get(peerId)

    if (ledger == null) {
      return undefined
    }

    return {
      peer: ledger.peerId,
      value: ledger.debtRatio(),
      sent: ledger.bytesSent,
      received: ledger.bytesReceived,
      exchanged: ledger.exchangeCount
    }
  }

  wantListForPeer (peerId: PeerId): WantListEntry[] | undefined {
    const ledger = this.ledgerMap.get(peerId)

    if (ledger == null) {
      return undefined
    }

    return [...ledger.wants.values()]
  }

  peers (): PeerId[] {
    return Array.from(this.ledgerMap.values()).map((l) => l.peerId)
  }

  /**
   * Handle incoming messages
   */
  async receiveMessage (peerId: PeerId, message: BitswapMessage): Promise<void> {
    let ledger = this.ledgerMap.get(peerId)

    if (ledger == null) {
      ledger = new Ledger({
        peerId,
        blockstore: this.blockstore,
        network: this.network,
        logger: this.logger
      }, {
        maxSizeReplaceHasWithBlock: this.maxSizeReplaceHasWithBlock
      })
      this.ledgerMap.set(peerId, ledger)
    }

    // record the amount of block data received
    ledger.receivedBytes(message.blocks?.reduce((acc, curr) => acc + curr.data.byteLength, 0) ?? 0)

    if (message.wantlist != null) {
      // if the message has a full wantlist, clear the current wantlist
      if (message.wantlist.full === true) {
        ledger.wants.clear()
      }

      // clear cancelled wants and add new wants to the ledger
      for (const entry of message.wantlist.entries) {
        const cid = CID.decode(entry.cid)
        const cidStr = uint8ArrayToString(cid.multihash.bytes, 'base64')

        if (entry.cancel === true) {
          this.log('peer %p cancelled want of block for %c', peerId, cid)
          ledger.wants.delete(cidStr)
        } else {
          if (entry.wantType === WantType.WantHave) {
            this.log('peer %p wanted block presence for %c', peerId, cid)
          } else {
            this.log('peer %p wanted block for %c', peerId, cid)
          }

          ledger.wants.set(cidStr, {
            cid,
            priority: entry.priority,
            wantType: entry.wantType ?? WantType.WantBlock,
            sendDontHave: entry.sendDontHave ?? false
          })
        }
      }
    }

    this.log('send blocks to peer')
    await ledger.sendBlocksToPeer()
  }

  async receivedBlock (cid: CID, options: ProgressOptions<BitswapNotifyProgressEvents> & AbortOptions): Promise<void> {
    const cidStr = uint8ArrayToString(cid.multihash.bytes, 'base64')
    const ledgers: Ledger[] = []

    for (const ledger of this.ledgerMap.values()) {
      if (ledger.wants.has(cidStr)) {
        ledgers.push(ledger)
      }
    }

    await Promise.all(
      ledgers.map(async (ledger) => ledger.sendBlocksToPeer(options))
    )
  }

  peerDisconnected (peerId: PeerId): void {
    this.ledgerMap.delete(peerId)
  }
}
