/* eslint-disable no-loop-func */
import { setMaxListeners } from '@libp2p/interface'
import { anySignal } from 'any-signal'
import { Network } from './network.js'
import { PeerWantLists } from './peer-want-lists/index.js'
import { createBitswapSession } from './session.js'
import { Stats } from './stats.js'
import { WantList } from './want-list.js'
import type { BitswapOptions, Bitswap as BitswapInterface, BitswapWantProgressEvents, BitswapNotifyProgressEvents, WantListEntry, BitswapComponents } from './index.js'
import type { BlockBroker, CreateSessionOptions } from '@helia/interface'
import type { ComponentLogger, PeerId } from '@libp2p/interface'
import type { Logger } from '@libp2p/logger'
import type { AbortOptions } from '@multiformats/multiaddr'
import type { Blockstore } from 'interface-blockstore'
import type { CID } from 'multiformats/cid'
import type { ProgressOptions } from 'progress-events'

export interface WantOptions extends AbortOptions, ProgressOptions<BitswapWantProgressEvents> {
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

  constructor (components: BitswapComponents, init: BitswapOptions = {}) {
    this.logger = components.logger
    this.log = components.logger.forComponent('helia:bitswap')
    this.blockstore = components.blockstore

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
      logger: this.logger
    }, options)
  }

  async want (cid: CID, options: WantOptions = {}): Promise<Uint8Array> {
    const controller = new AbortController()
    // Combine the passed signal with the internal controller's signal
    const signal = anySignal([controller.signal, options.signal])
    // Ensure listeners don't cause warnings, especially with multiple operations
    setMaxListeners(Infinity, controller.signal, signal)

    // 1. Initiate the request via wantList (checks connected peers and waits for block)
    // This promise resolves when the block is successfully received by the wantList,
    // regardless of whether it came from a direct peer or via the network lookup.
    const blockPromise = this.wantList.wantBlock(cid, {
      ...options,
      signal // Pass the combined signal
    });

    // 2. Initiate the network search concurrently (DHT lookup etc.)
    // We don't necessarily need to await this promise directly,
    // as its purpose is to find *providers* and connect to them.
    // The wantList should eventually receive the block if this succeeds.
    // We run it in the background and handle potential errors.
    // Ensure we don't start findAndConnect if already aborted
    if (!signal.aborted) {
        this.network.findAndConnect(cid, {
            ...options,
            signal // Use the same combined signal
        })
        .catch(err => {
            // Only log if not aborted externally or by blockPromise succeeding/failing first
            // If the signal was aborted, it's likely because blockPromise resolved or failed, or the user aborted.
            if (!signal.aborted) {
              this.log.error('want %c: error during background findAndConnect: %s', cid, err.message ?? err);
            }
            // We don't necessarily need to abort the controller here,
            // as blockPromise might still succeed from a direct peer.
            // If blockPromise fails later, the main try/catch will handle it.
        });
    }

    try {
      // 3. Await the blockPromise. This will resolve if the block is found
      // either quickly from a connected peer or after findAndConnect helps locate a provider.
      const result = await blockPromise;
      // console.log('want %c: block received successfully', cid);
      controller.abort(); // Abort controller and signal findAndConnect to stop
      return result.block;
    } catch (err: any) {
      this.log.error('want %c: failed to receive block via wantList: %s', cid, err.message ?? err);
      controller.abort(); // Ensure controller and findAndConnect signal are aborted on final failure
      throw err; // Re-throw the error from wantList.wantBlock
    } finally {
        // Cleanup signal listeners associated with anySignal
        if (typeof signal.clear === 'function') {
            signal.clear();
        }
        // Ensure the internal controller's listeners are removed
        controller.abort();
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
