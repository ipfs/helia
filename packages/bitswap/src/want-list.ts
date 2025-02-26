import { TypedEventEmitter, setMaxListeners } from '@libp2p/interface'
import { trackedPeerMap } from '@libp2p/peer-collections'
import { trackedMap } from '@libp2p/utils/tracked-map'
import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import pDefer from 'p-defer'
import { raceEvent } from 'race-event'
import { equals as uint8ArrayEquals } from 'uint8arrays/equals'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { DEFAULT_MESSAGE_SEND_DELAY } from './constants.js'
import { BlockPresenceType, WantType } from './pb/message.js'
import { QueuedBitswapMessage } from './utils/bitswap-message.js'
import vd from './utils/varint-decoder.js'
import type { BitswapNotifyProgressEvents, MultihashHasherLoader } from './index.js'
import type { BitswapNetworkWantProgressEvents, Network } from './network.js'
import type { BitswapMessage } from './pb/message.js'
import type { ComponentLogger, PeerId, Startable, AbortOptions, Libp2p, TypedEventTarget, Metrics } from '@libp2p/interface'
import type { Logger } from '@libp2p/logger'
import type { PeerMap } from '@libp2p/peer-collections'
import type { DeferredPromise } from 'p-defer'
import type { ProgressOptions } from 'progress-events'

export interface WantListComponents {
  network: Network
  logger: ComponentLogger
  libp2p: Libp2p
  metrics?: Metrics
}

export interface WantListInit {
  sendMessagesDelay?: number
  hashLoader?: MultihashHasherLoader
}

export interface WantListEntry {
  /**
   * The CID we send to the remote
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
   * Whether we are cancelling the block want or not
   */
  cancel: boolean

  /**
   * Whether the remote should tell us if they have the block or not
   */
  sendDontHave: boolean
}

export interface WantOptions extends AbortOptions, ProgressOptions<BitswapNetworkWantProgressEvents> {
  /**
   * Allow prioritizing blocks
   */
  priority?: number
}

export interface WantBlockResult {
  sender: PeerId
  cid: CID
  block: Uint8Array
}

export interface WantDoNotHaveResult {
  sender: PeerId
  cid: CID
  has: false
}

export interface WantHaveResult {
  sender: PeerId
  cid: CID
  has: true
  block?: Uint8Array
}

export type WantPresenceResult = WantDoNotHaveResult | WantHaveResult

export interface WantListEvents {
  block: CustomEvent<WantBlockResult>
  presence: CustomEvent<WantPresenceResult>
}

export class WantList extends TypedEventEmitter<WantListEvents> implements Startable, TypedEventTarget<WantListEvents> {
  /**
   * Tracks what CIDs we've previously sent to which peers
   */
  public readonly peers: PeerMap<Set<string>>
  public readonly wants: Map<string, WantListEntry>
  private readonly network: Network
  private readonly log: Logger
  private readonly sendMessagesDelay: number
  private sendMessagesTimeout?: ReturnType<typeof setTimeout>
  private readonly hashLoader?: MultihashHasherLoader
  private sendingMessages?: DeferredPromise<void>

  constructor (components: WantListComponents, init: WantListInit = {}) {
    super()

    setMaxListeners(Infinity, this)
    this.peers = trackedPeerMap({
      name: 'helia_bitswap_peers',
      metrics: components.metrics
    })
    this.wants = trackedMap({
      name: 'helia_bitswap_wantlist',
      metrics: components.metrics
    })
    this.network = components.network
    this.sendMessagesDelay = init.sendMessagesDelay ?? DEFAULT_MESSAGE_SEND_DELAY
    this.log = components.logger.forComponent('helia:bitswap:wantlist')
    this.hashLoader = init.hashLoader

    this.network.addEventListener('bitswap:message', (evt) => {
      this.receiveMessage(evt.detail.peer, evt.detail.message)
        .catch(err => {
          this.log.error('error receiving bitswap message from %p', evt.detail.peer, err)
        })
    })
    this.network.addEventListener('peer:connected', evt => {
      this.peerConnected(evt.detail)
        .catch(err => {
          this.log.error('error processing newly connected bitswap peer %p', evt.detail, err)
        })
    })
    this.network.addEventListener('peer:disconnected', evt => {
      this.peerDisconnected(evt.detail)
    })
  }

  private async addEntry (cid: CID, options: WantOptions & { wantType: WantType.WantBlock }): Promise<WantBlockResult>
  private async addEntry (cid: CID, options: WantOptions & { wantType: WantType.WantHave }): Promise<WantPresenceResult>
  private async addEntry (cid: CID, options: WantOptions & { wantType: WantType }): Promise<WantBlockResult | WantPresenceResult> {
    const cidStr = uint8ArrayToString(cid.multihash.bytes, 'base64')
    let entry = this.wants.get(cidStr)

    if (entry == null) {
      entry = {
        cid,
        priority: options.priority ?? 1,
        wantType: options.wantType ?? WantType.WantBlock,
        cancel: false,
        sendDontHave: true
      }

      this.wants.set(cidStr, entry)
    }

    // upgrade want-have to want-block if the new want is a WantBlock but the
    // previous want was a WantHave
    if (entry.wantType === WantType.WantHave && options.wantType === WantType.WantBlock) {
      entry.wantType = WantType.WantBlock
    }

    // broadcast changes
    await this.sendMessagesDebounced()

    try {
      if (options.wantType === WantType.WantBlock) {
        const event = await raceEvent<CustomEvent<WantBlockResult>>(this, 'block', options?.signal, {
          filter: (event) => {
            return uint8ArrayEquals(cid.multihash.digest, event.detail.cid.multihash.digest)
          },
          errorMessage: 'Want was aborted'
        })

        return event.detail
      }

      const event = await raceEvent<CustomEvent<WantPresenceResult>>(this, 'presence', options?.signal, {
        filter: (event) => {
          return uint8ArrayEquals(cid.multihash.digest, event.detail.cid.multihash.digest)
        },
        errorMessage: 'Want was aborted'
      })

      return event.detail
    } finally {
      if (options.signal?.aborted === true) {
        this.log('want for %c was aborted, cancelling want', cid)
        entry.cancel = true
        // broadcast changes
        await this.sendMessagesDebounced()
      }
    }
  }

  private async sendMessagesDebounced (): Promise<void> {
    await this.sendingMessages?.promise

    // broadcast changes
    clearTimeout(this.sendMessagesTimeout)
    this.sendMessagesTimeout = setTimeout(() => {
      void this.sendMessages()
        .catch(err => {
          this.log('error sending messages to peers', err)
        })
    }, this.sendMessagesDelay)
  }

  private async sendMessages (): Promise<void> {
    this.sendingMessages = pDefer()

    await Promise.all(
      [...this.peers.entries()].map(async ([peerId, sentWants]) => {
        const sent = new Set<string>()
        const message = new QueuedBitswapMessage()

        for (const [key, entry] of this.wants.entries()) {
          const sentPreviously = sentWants.has(key)

          // only send if either we've not sent it before, or we haven't sent it
          // but we're also cancelling the want.
          if (sentPreviously || entry.cancel) {
            continue
          }

          sent.add(key)

          message.addWantlistEntry(entry.cid, {
            cid: entry.cid.bytes,
            priority: entry.priority,
            wantType: entry.wantType,
            cancel: entry.cancel,
            sendDontHave: entry.sendDontHave
          })
        }

        if (message.wantlist.size === 0) {
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
      })
    ).catch(err => {
      this.log.error('error sending messages', err)
    })

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

    this.sendingMessages.resolve()
  }

  has (cid: CID): boolean {
    const cidStr = uint8ArrayToString(cid.multihash.bytes, 'base64')
    return this.wants.has(cidStr)
  }

  /**
   * Add a CID to the wantlist
   */
  async wantSessionPresence (cid: CID, peerId: PeerId, options: WantOptions = {}): Promise<WantPresenceResult> {
    const message = new QueuedBitswapMessage()
    message.addWantlistEntry(cid, {
      cid: cid.bytes,
      sendDontHave: true,
      wantType: WantType.WantHave,
      priority: 1
    })

    // sending WantHave directly to peer
    await this.network.sendMessage(peerId, message)

    // wait for peer response
    const event = await raceEvent<CustomEvent<WantHaveResult | WantDoNotHaveResult>>(this, 'presence', options.signal, {
      filter: (event) => {
        return peerId.equals(event.detail.sender) && uint8ArrayEquals(cid.multihash.digest, event.detail.cid.multihash.digest)
      }
    })

    return event.detail
  }

  /**
   * Add a CID to the wantlist
   */
  async wantBlock (cid: CID, options: WantOptions = {}): Promise<WantBlockResult> {
    return this.addEntry(cid, {
      ...options,
      wantType: WantType.WantBlock
    })
  }

  /**
   * Add a CID to the wantlist
   */
  async wantSessionBlock (cid: CID, peerId: PeerId, options: WantOptions = {}): Promise<WantPresenceResult> {
    const message = new QueuedBitswapMessage()
    message.addWantlistEntry(cid, {
      cid: cid.bytes,
      sendDontHave: true,
      wantType: WantType.WantBlock,
      priority: 1
    })

    // sending WantBlockResult directly to peer
    await this.network.sendMessage(peerId, message)

    // wait for peer response
    const event = await raceEvent<CustomEvent<WantPresenceResult>>(this, 'presence', options.signal, {
      filter: (event) => {
        return peerId.equals(event.detail.sender) && uint8ArrayEquals(cid.multihash.digest, event.detail.cid.multihash.digest)
      }
    })

    return event.detail
  }

  /**
   * Invoked when a block has been received from an external source
   */
  async receivedBlock (cid: CID, options: ProgressOptions<BitswapNotifyProgressEvents> & AbortOptions): Promise<void> {
    const cidStr = uint8ArrayToString(cid.multihash.bytes, 'base64')

    const entry = this.wants.get(cidStr)

    if (entry == null) {
      return
    }

    entry.cancel = true

    await this.sendMessagesDebounced()
  }

  /**
   * Invoked when a message is received from a bitswap peer
   */
  private async receiveMessage (sender: PeerId, message: BitswapMessage): Promise<void> {
    this.log('received message from %p with %d blocks', sender, message.blocks.length)
    let blocksCancelled = false

    // process blocks
    for (const block of message.blocks) {
      if (block.prefix == null || block.data == null) {
        continue
      }

      const values = vd(block.prefix)
      const cidVersion = values[0]
      const multicodec = values[1]
      const hashAlg = values[2]
      // const hashLen = values[3] // We haven't need to use this so far

      const hasher = hashAlg === sha256.code ? sha256 : await this.hashLoader?.getHasher(hashAlg)

      if (hasher == null) {
        this.log.error('unknown hash algorithm', hashAlg)
        continue
      }

      let hash: any = hasher.digest(block.data)

      if (hash.then != null) {
        hash = await hash
      }

      const cid = CID.create(cidVersion === 0 ? 0 : 1, multicodec, hash)

      this.log('received block from %p for %c', sender, cid)

      this.safeDispatchEvent<WantBlockResult>('block', {
        detail: {
          sender,
          cid,
          block: block.data
        }
      })

      this.safeDispatchEvent<WantHaveResult | WantDoNotHaveResult>('presence', {
        detail: {
          sender,
          cid,
          has: true,
          block: block.data
        }
      })

      const cidStr = uint8ArrayToString(cid.multihash.bytes, 'base64')
      const entry = this.wants.get(cidStr)

      if (entry == null) {
        continue
      }

      // since we received the block, flip the cancel flag to send cancels to
      // any peers on the next message sending iteration, this will remove it
      // from the internal want list
      entry.cancel = true
      blocksCancelled = true
    }

    // process block presences
    for (const { cid: cidBytes, type } of message.blockPresences) {
      const cid = CID.decode(cidBytes)

      this.log('received %s from %p for %c', type, sender, cid)

      this.safeDispatchEvent<WantHaveResult | WantDoNotHaveResult>('presence', {
        detail: {
          sender,
          cid,
          has: type === BlockPresenceType.HaveBlock
        }
      })
    }

    if (blocksCancelled) {
      await this.sendMessagesDebounced()
    }
  }

  /**
   * Invoked when the network topology notices a new peer that supports Bitswap
   */
  async peerConnected (peerId: PeerId): Promise<void> {
    const sentWants = new Set<string>()
    const message = new QueuedBitswapMessage(true)

    // new peer, give them the full wantlist
    for (const [key, entry] of this.wants.entries()) {
      if (entry.cancel) {
        continue
      }

      sentWants.add(key)

      message.addWantlistEntry(entry.cid, {
        cid: entry.cid.bytes,
        priority: 1,
        wantType: WantType.WantBlock,
        cancel: false,
        sendDontHave: false
      })
    }

    // only send the wantlist if we have something to send
    if (message.wantlist.size === 0) {
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

  /**
   * Invoked when the network topology notices peer that supports Bitswap has
   * disconnected
   */
  peerDisconnected (peerId: PeerId): void {
    this.peers.delete(peerId)
  }

  start (): void {

  }

  stop (): void {
    this.peers.clear()
    clearTimeout(this.sendMessagesTimeout)
  }
}
