import { CodeError } from '@libp2p/interface'
import { PeerSet } from '@libp2p/peer-collections'
import type { BitswapWantProgressEvents, BitswapSession as BitswapSessionInterface } from './index.js'
import type { Network } from './network.js'
import type { Notifications } from './notifications.js'
import type { WantList } from './want-list.js'
import type { ComponentLogger, Logger } from '@libp2p/interface'
import type { AbortOptions } from 'interface-store'
import type { CID } from 'multiformats/cid'
import type { ProgressOptions } from 'progress-events'

export interface BitswapSessionComponents {
  notifications: Notifications
  network: Network
  wantList: WantList
  logger: ComponentLogger
}

export interface BitswapSessionInit {
  root: CID
}

class BitswapSession implements BitswapSessionInterface {
  public readonly root: CID
  public readonly peers: PeerSet
  private readonly log: Logger
  private readonly notifications: Notifications
  private readonly wantList: WantList

  constructor (components: BitswapSessionComponents, init: BitswapSessionInit) {
    this.peers = new PeerSet()
    this.root = init.root
    this.log = components.logger.forComponent(`bitswap:session:${init.root}`)
    this.notifications = components.notifications
    this.wantList = components.wantList
  }

  async want (cid: CID, options?: AbortOptions & ProgressOptions<BitswapWantProgressEvents>): Promise<Uint8Array> {
    if (this.peers.size === 0) {
      throw new CodeError('Bitswap session had no peers', 'ERR_NO_SESSION_PEERS')
    }

    // normalize to v1 CID
    cid = cid.toV1()

    this.log('sending WANT-BLOCK for %c to', cid, this.peers)

    await this.wantList.wantBlocks([cid], {
      session: this.peers,
      sendDontHave: true
    })

    const block = await this.notifications.wantBlock(cid, options)

    this.log('sending cancels for %c to', cid, this.peers)

    await this.wantList.cancelWants([cid], {
      session: this.peers
    })

    return block
  }
}

export function createBitswapSession (components: BitswapSessionComponents, init: BitswapSessionInit): BitswapSessionInterface {
  return new BitswapSession(components, init)
}
