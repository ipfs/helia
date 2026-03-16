import { trackedPeerMap } from '@libp2p/peer-collections'
import { CID } from 'multiformats/cid'
import { Ledger } from './ledger.ts'
import type { BitswapNotifyProgressEvents, PeerWantListEntry } from '../index.ts'
import type { Network } from '../network.ts'
import type { BitswapMessage } from '../pb/message.ts'
import type { AbortOptions, ComponentLogger, Libp2p, Logger, Metrics, PeerId } from '@libp2p/interface'
import type { PeerMap } from '@libp2p/peer-collections'
import type { Blockstore } from 'interface-blockstore'
import type { ProgressOptions } from 'progress-events'

export interface PeerWantListsInit {
  maxSizeReplaceHasWithBlock?: number
  doNotResendBlockWindow?: number
  maxWantListSize?: number
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
  private readonly doNotResendBlockWindow?: number
  private readonly maxWantListSize?: number
  private readonly log: Logger
  private readonly logger: ComponentLogger

  constructor (components: PeerWantListsComponents, init: PeerWantListsInit = {}) {
    this.blockstore = components.blockstore
    this.network = components.network
    this.maxSizeReplaceHasWithBlock = init.maxSizeReplaceHasWithBlock
    this.doNotResendBlockWindow = init.doNotResendBlockWindow
    this.maxWantListSize = init.maxWantListSize
    this.log = components.logger.forComponent('helia:bitswap:peer-want-lists')
    this.logger = components.logger

    this.ledgerMap = trackedPeerMap({
      name: 'helia_bitswap_ledger_map',
      metrics: components.metrics
    })

    this.network.addEventListener('bitswap:message', (evt) => {
      this.receiveMessage(evt.detail.peer, evt.detail.message)
        .catch(err => {
          this.log.error('error receiving bitswap message from %p - %e', evt.detail.peer, err)
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

  wantListForPeer (peerId: PeerId): PeerWantListEntry[] | undefined {
    const ledger = this.ledgerMap.get(peerId)

    if (ledger == null) {
      return undefined
    }

    // remove any expired wants
    ledger.removeExpiredWants()

    return ledger.getWants()
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
        maxSizeReplaceHasWithBlock: this.maxSizeReplaceHasWithBlock,
        doNotResendBlockWindow: this.doNotResendBlockWindow,
        maxWantListSize: this.maxWantListSize
      })
      this.ledgerMap.set(peerId, ledger)
    }

    // record the amount of block data received
    ledger.receivedBytes(message.blocks?.reduce((acc, curr) => acc + curr.data.byteLength, 0) ?? 0)

    // remove any expired wants
    ledger.removeExpiredWants()

    // add new wants
    ledger.addWants(message.wantlist)

    this.log('send blocks to peer')
    await ledger.sendBlocksToPeer()
  }

  async receivedBlock (cid: CID, options: ProgressOptions<BitswapNotifyProgressEvents> & AbortOptions): Promise<void> {
    const ledgers: Ledger[] = []

    for (const ledger of this.ledgerMap.values()) {
      if (ledger.hasWant(cid)) {
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
