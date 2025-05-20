import { setMaxListeners } from '@libp2p/interface'
import { anySignal } from 'any-signal'
import { Network } from './network.js'
import { PeerWantLists } from './peer-want-lists/index.js'
import { createBitswapSession } from './session.js'
import { Stats } from './stats.js'
import { WantList } from './want-list.js'
import type { BitswapOptions, Bitswap as BitswapInterface, BitswapWantProgressEvents, BitswapNotifyProgressEvents, WantListEntry, BitswapComponents } from './index.js'
import type { BlockBroker, CreateSessionOptions, ProviderOptions } from '@helia/interface'
import type { ComponentLogger, Libp2p, PeerId } from '@libp2p/interface'
import type { Logger } from '@libp2p/logger'
import type { AbortOptions } from '@multiformats/multiaddr'
import type { Blockstore } from 'interface-blockstore'
import type { CID } from 'multiformats/cid'
import type { ProgressOptions } from 'progress-events'

export interface WantOptions extends AbortOptions, ProgressOptions<BitswapWantProgressEvents>, ProviderOptions {
  /**
   * When searching the routing for providers, stop searching after finding this
   * many providers.
   *
   * @default 3
   */
  maxProviders?: number
}

/**
 * JavaScript implementation of the Bitswap 'data exchange' protocol
 * used by IPFS.
 */
export class Bitswap implements BitswapInterface {
  private readonly log: Logger
  private readonly logger: ComponentLogger
  public readonly stats: Stats
  public network: Network
  public blockstore: Blockstore
  public peerWantLists: PeerWantLists
  public wantList: WantList
  public libp2p: Libp2p

  constructor (components: BitswapComponents, init: BitswapOptions = {}) {
    this.logger = components.logger
    this.log = components.logger.forComponent('helia:bitswap')
    this.blockstore = components.blockstore
    this.libp2p = components.libp2p

    // report stats to libp2p metrics
    this.stats = new Stats(components)

    // the network delivers messages
    this.network = new Network(components, init)

    // handle which blocks we send to peers
    this.peerWantLists = new PeerWantLists({
      ...components,
      network: this.network
    }, init)

    // handle which blocks we ask peers for
    this.wantList = new WantList({
      ...components,
      network: this.network
    }, init)
  }

  createSession (options: CreateSessionOptions = {}): Required<Pick<BlockBroker<BitswapWantProgressEvents>, 'retrieve'>> {
    return createBitswapSession({
      wantList: this.wantList,
      network: this.network,
      logger: this.logger,
      libp2p: this.libp2p
    }, options)
  }

  async want (cid: CID, options: WantOptions = {}): Promise<Uint8Array> {
    const controller = new AbortController()
    const signal = anySignal([controller.signal, options.signal])
    setMaxListeners(Infinity, controller.signal, signal)

    // find providers and connect to them
    this.network.findAndConnect(cid, {
      ...options,
      signal
    })
      .catch(err => {
        // if the controller was aborted we found the block already so ignore
        // the error
        if (!controller.signal.aborted) {
          this.log.error('error during finding and connect for cid %c', cid, err)
        }
      })

    try {
      const result = await this.wantList.wantBlock(cid, {
        ...options,
        signal
      })

      return result.block
    } finally {
      // since we have the block we can now abort any outstanding attempts to
      // find providers for it
      controller.abort()
      signal.clear()
    }
  }

  /**
   * Sends notifications about the arrival of a block
   */
  async notify (cid: CID, block: Uint8Array, options: ProgressOptions<BitswapNotifyProgressEvents> & AbortOptions = {}): Promise<void> {
    await Promise.all([
      this.peerWantLists.receivedBlock(cid, options),
      this.wantList.receivedBlock(cid, options)
    ])
  }

  getWantlist (): WantListEntry[] {
    return [...this.wantList.wants.values()]
      .filter(entry => !entry.cancel)
      .map(entry => ({
        cid: entry.cid,
        priority: entry.priority,
        wantType: entry.wantType
      }))
  }

  getPeerWantlist (peer: PeerId): WantListEntry[] | undefined {
    return this.peerWantLists.wantListForPeer(peer)
  }

  /**
   * Start the bitswap node
   */
  async start (): Promise<void> {
    this.wantList.start()
    await this.network.start()
  }

  /**
   * Stop the bitswap node
   */
  async stop (): Promise<void> {
    this.wantList.stop()
    await this.network.stop()
  }
}
