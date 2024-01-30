import { EventEmitter } from 'events'
import { CodeError } from '@libp2p/interface'
import { CustomProgressEvent, type ProgressOptions } from 'progress-events'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import type { BitswapWantBlockProgressEvents } from './index.js'
import type { AbortOptions, ComponentLogger, PeerId } from '@libp2p/interface'
import type { Logger } from '@libp2p/logger'
import type { CID } from 'multiformats/cid'

/**
 * Return the event name for an unwant of the passed CID
 */
export const unwantEvent = (cid: CID): string => `unwant:${uint8ArrayToString(cid.multihash.bytes, 'base64')}`

/**
 * Return the event name for the receipt of the block for the passed CID
 */
export const receivedBlockEvent = (cid: CID): string => `block:${uint8ArrayToString(cid.multihash.bytes, 'base64')}`

/**
 * Return the event name for a peer telling us they have the block for the
 * passed CID
 */
export const haveEvent = (cid: CID): string => `have:${uint8ArrayToString(cid.multihash.bytes, 'base64')}`

/**
 * Return the event name for a peer telling us they do not have the block for
 * the passed CID
 */
export const doNotHaveEvent = (cid: CID): string => `do-not-have:${uint8ArrayToString(cid.multihash.bytes, 'base64')}`

export interface ReceivedBlockListener {
  (block: Uint8Array, peer: PeerId): void
}

export interface HaveBlockListener {
  (peer: PeerId): void
}

export interface DoNotHaveBlockListener {
  (peer: PeerId): void
}

export interface NotificationsComponents {
  logger: ComponentLogger
}

export class Notifications extends EventEmitter {
  private readonly log: Logger

  /**
   * Internal module used to track events about incoming blocks,
   * wants and unwants.
   */
  constructor (components: NotificationsComponents) {
    super()

    this.setMaxListeners(Infinity)
    this.log = components.logger.forComponent('helia:bitswap:notifications')
  }

  /**
   * Signal the system that the passed peer has the block
   */
  haveBlock (cid: CID, peer: PeerId): void {
    const event = haveEvent(cid)
    this.log(event)
    this.emit(event, peer)
  }

  /**
   * Signal the system that the passed peer does not have block
   */
  doNotHaveBlock (cid: CID, peer: PeerId): void {
    const event = doNotHaveEvent(cid)
    this.log(event)
    this.emit(event, peer)
  }

  /**
   * Signal the system that we received `block` from the passed peer
   */
  receivedBlock (cid: CID, block: Uint8Array, peer: PeerId): void {
    const event = receivedBlockEvent(cid)
    this.log(event)
    this.emit(event, block, peer)
  }

  /**
   * Signal the system that we are waiting to receive the block associated with
   * the given `cid`.
   *
   * Returns a Promise that resolves to the block when it is received, or
   * rejects if the block is unwanted.
   */
  async wantBlock (cid: CID, options: AbortOptions & ProgressOptions<BitswapWantBlockProgressEvents> = {}): Promise<Uint8Array> {
    const blockEvt = receivedBlockEvent(cid)
    const unwantEvt = unwantEvent(cid)

    this.log(`wantBlock:${cid}`)

    return new Promise((resolve, reject) => {
      const onUnwant = (): void => {
        this.removeListener(blockEvt, onBlock)

        options.onProgress?.(new CustomProgressEvent<CID>('bitswap:want-block:unwant', cid))
        reject(new CodeError(`Block for ${cid} unwanted`, 'ERR_UNWANTED'))
      }

      const onBlock = (data: Uint8Array): void => {
        this.removeListener(unwantEvt, onUnwant)

        options.onProgress?.(new CustomProgressEvent<CID>('bitswap:want-block:block', cid))
        resolve(data)
      }

      this.once(unwantEvt, onUnwant)
      this.once(blockEvt, onBlock)

      options.signal?.addEventListener('abort', () => {
        this.removeListener(blockEvt, onBlock)
        this.removeListener(unwantEvt, onUnwant)

        reject(new CodeError(`Want for ${cid} aborted`, 'ERR_ABORTED'))
      })
    })
  }

  /**
   * Signal that the block is not wanted any more
   */
  unwantBlock (cid: CID): void {
    const event = unwantEvent(cid)
    this.log(event)
    this.emit(event)
  }
}
