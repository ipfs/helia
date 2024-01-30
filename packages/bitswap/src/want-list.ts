import { trackedPeerMap, PeerSet } from '@libp2p/peer-collections'
import { trackedMap } from '@libp2p/utils/tracked-map'
import all from 'it-all'
import filter from 'it-filter'
import map from 'it-map'
import { pipe } from 'it-pipe'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { WantType } from './pb/message.js'
import type { WantListEntry } from './index.js'
import type { Network } from './network.js'
import type { BitswapMessage } from './pb/message.js'
import type { ComponentLogger, Metrics, PeerId, Startable } from '@libp2p/interface'
import type { Logger } from '@libp2p/logger'
import type { PeerMap } from '@libp2p/peer-collections'
import type { CID } from 'multiformats/cid'

export interface WantListComponents {
  network: Network
  logger: ComponentLogger
  metrics?: Metrics
}

export interface WantBlocksOptions {
  /**
   * If set, this wantlist entry will only be sent to peers in the peer set
   */
  session?: PeerSet

  /**
   * Allow prioritsing blocks
   */
  priority?: number

  /**
   * Specify if the remote should send us the block or just tell us they have
   * the block
   */
  wantType?: WantType

  /**
   * Pass true to get the remote to tell us if they don't have the block rather
   * than not replying at all
   */
  sendDontHave?: boolean

  /**
   * Pass true to cancel wants with peers
   */
  cancel?: boolean
}

export class WantList implements Startable {
  /**
   * Tracks what CIDs we've previously sent to which peers
   */
  public readonly peers: PeerMap<Set<string>>
  public readonly wants: Map<string, WantListEntry>
  private readonly network: Network
  private readonly log: Logger

  constructor (components: WantListComponents) {
    this.peers = trackedPeerMap({
      name: 'ipfs_bitswap_peers',
      metrics: components.metrics
    })
    this.wants = trackedMap({
      name: 'ipfs_bitswap_wantlist',
      metrics: components.metrics
    })
    this.network = components.network
    this.log = components.logger.forComponent('helia:bitswap:wantlist:self')
  }

  async _addEntries (cids: CID[], options: WantBlocksOptions = {}): Promise<void> {
    for (const cid of cids) {
      const cidStr = uint8ArrayToString(cid.multihash.bytes, 'base64')
      let entry = this.wants.get(cidStr)

      if (entry == null) {
        // we are cancelling a want that's not in our wantlist
        if (options.cancel === true) {
          continue
        }

        entry = {
          cid,
          session: options.session ?? new PeerSet(),
          priority: options.priority ?? 1,
          wantType: options.wantType ?? WantType.WantBlock,
          cancel: Boolean(options.cancel),
          sendDontHave: Boolean(options.sendDontHave)
        }
      }

      // upgrade want-have to want-block
      if (entry.wantType === WantType.WantHave && options.wantType === WantType.WantBlock) {
        entry.wantType = WantType.WantBlock
      }

      // cancel the want if requested to do so
      if (options.cancel === true) {
        entry.cancel = true
      }

      // if this entry has previously been part of a session but the new want
      // is not, make this want a non-session want
      if (options.session == null) {
        entry.session = new PeerSet()
      }

      this.wants.set(cidStr, entry)
    }

    // broadcast changes
    await this.sendMessages()
  }

  async sendMessages (): Promise<void> {
    for (const [peerId, sentWants] of this.peers) {
      const sent = new Set<string>()
      const message: Partial<BitswapMessage> = {
        wantlist: {
          full: false,
          entries: pipe(
            this.wants.entries(),
            (source) => filter(source, ([key, entry]) => {
              // skip session-only wants
              if (entry.session.size > 0 && !entry.session.has(peerId)) {
                return false
              }

              const sentPreviously = sentWants.has(key)

              // don't cancel if we've not sent it to them before
              if (entry.cancel) {
                return sentPreviously
              }

              // only send if we've not sent it to them before
              return !sentPreviously
            }),
            (source) => map(source, ([key, entry]) => {
              sent.add(key)

              return {
                cid: entry.cid.bytes,
                priority: entry.priority,
                wantType: entry.wantType,
                cancel: entry.cancel,
                sendDontHave: entry.sendDontHave
              }
            }),
            (source) => all(source)
          )
        }
      }

      if (message.wantlist?.entries.length === 0) {
        return
      }

      // add message to send queue
      try {
        await this.network.sendMessage(peerId, message)

        // update list of messages sent to remote
        for (const key of sent) {
          sentWants.add(key)
        }
      } catch (err: any) {
        this.log.error('error sending full wantlist to new peer', err)
      }
    }

    // queued all message sends, remove cancelled wants from wantlist and sent
    // wants
    for (const [key, entry] of this.wants) {
      if (entry.cancel) {
        this.wants.delete(key)

        for (const sentWants of this.peers.values()) {
          sentWants.delete(key)
        }
      }
    }
  }

  /**
   * Add all the CIDs to the wantlist
   */
  async wantBlocks (cids: CID[], options: WantBlocksOptions = {}): Promise<void> {
    await this._addEntries(cids, options)
  }

  /**
   * Remove CIDs from the wantlist without sending cancel messages
   */
  unwantBlocks (cids: CID[], options: WantBlocksOptions = {}): void {
    cids.forEach(cid => {
      const cidStr = uint8ArrayToString(cid.multihash.bytes, 'base64')

      this.wants.delete(cidStr)
    })
  }

  /**
   * Send cancel messages to peers for the passed CIDs
   */
  async cancelWants (cids: CID[], options: WantBlocksOptions = {}): Promise<void> {
    this.log('cancel wants: %s', cids.length)
    await this._addEntries(cids, {
      ...options,
      cancel: true
    })
  }

  async connected (peerId: PeerId): Promise<void> {
    const sentWants = new Set<string>()

    // new peer, give them the full wantlist
    const message: Partial<BitswapMessage> = {
      wantlist: {
        full: true,
        entries: pipe(
          this.wants.entries(),
          (source) => filter(source, ([key, entry]) => !entry.cancel && (entry.session.size > 0 && !entry.session.has(peerId))),
          (source) => filter(source, ([key, entry]) => !entry.cancel),
          (source) => map(source, ([key, entry]) => {
            sentWants.add(key)

            return {
              cid: entry.cid.bytes,
              priority: 1,
              wantType: WantType.WantBlock,
              cancel: false,
              sendDontHave: false
            }
          }),
          (source) => all(source)
        )
      }
    }

    // only send the wantlist if we have something to send
    if (message.wantlist?.entries.length === 0) {
      this.peers.set(peerId, sentWants)

      return
    }

    try {
      await this.network.sendMessage(peerId, message)

      this.peers.set(peerId, sentWants)
    } catch (err) {
      this.log.error('error sending full wantlist to new peer %p', peerId, err)
    }
  }

  disconnected (peerId: PeerId): void {
    this.peers.delete(peerId)
  }

  start (): void {

  }

  stop (): void {
    this.peers.clear()
  }
}
