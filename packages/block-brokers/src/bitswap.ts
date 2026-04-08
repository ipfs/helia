import { createBitswap } from '@helia/bitswap'
import { isPeerId } from '@libp2p/interface'
import { CustomProgressEvent } from 'progress-events'
import type { BitswapOptions, Bitswap, BitswapWantBlockProgressEvents, BitswapNotifyProgressEvents } from '@helia/bitswap'
import type { BlockAnnounceOptions, BlockBroker, BlockRetrievalOptions, CreateSessionOptions, Routing, HasherLoader, SessionBlockBroker, BlockBrokerConnectProgressEvent, BlockBrokerConnectedProgressEvent, BlockBrokerRequestBlockProgressEvent, BlockBrokerReceiveBlockProgressEvent } from '@helia/interface'
import type { Libp2p, Startable, ComponentLogger } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { CID } from 'multiformats/cid'

export interface BitswapBlockBrokerComponents {
  libp2p: Libp2p
  blockstore: Blockstore
  routing: Routing
  logger: ComponentLogger
  getHasher: HasherLoader
}

export interface BitswapBlockBrokerInit extends BitswapOptions {

}

class BitswapBlockBroker implements BlockBroker<BitswapWantBlockProgressEvents, BitswapNotifyProgressEvents>, Startable {
  public readonly name = 'bitswap'
  private readonly bitswap: Bitswap
  private started: boolean

  constructor (components: BitswapBlockBrokerComponents, init: BitswapBlockBrokerInit = {}) {
    this.bitswap = createBitswap(components, init)
    this.started = false
  }

  isStarted (): boolean {
    return this.started
  }

  async start (): Promise<void> {
    await this.bitswap.start()
    this.started = true
  }

  async stop (): Promise<void> {
    await this.bitswap.stop()
    this.started = false
  }

  async announce (cid: CID, options?: BlockAnnounceOptions<BitswapNotifyProgressEvents>): Promise<void> {
    await this.bitswap.notify(cid, options)
  }

  async retrieve (cid: CID, options: BlockRetrievalOptions<BitswapWantBlockProgressEvents> = {}): Promise<Uint8Array> {
    return this.bitswap.want(cid, {
      ...options,
      onProgress: (evt) => {
        if (options?.onProgress == null) {
          return
        }

        options.onProgress(evt)

        if (evt.type === 'connection:open') {
          if (!isPeerId(evt.detail)) {
            // should not happen as bitswap impl only sends wantlist to
            // connected peers so we always have a peer id
            return
          }

          options.onProgress(new CustomProgressEvent<BlockBrokerConnectProgressEvent>('helia:block-broker:connect', {
            broker: 'bitswap',
            type: 'connect',
            provider: evt.detail,
            cid
          }))
        } else if (evt.type === 'connection:opened') {
          options.onProgress(new CustomProgressEvent<BlockBrokerConnectedProgressEvent>('helia:block-broker:connected', {
            broker: 'bitswap',
            type: 'connected',
            provider: evt.detail.remotePeer,
            address: evt.detail.remoteAddr,
            cid
          }))
        } else if (evt.type === 'connection:open-stream') {
          options.onProgress(new CustomProgressEvent<BlockBrokerRequestBlockProgressEvent>('helia:block-broker:request-block', {
            broker: 'bitswap',
            type: 'request-block',
            provider: evt.detail.connection.remotePeer,
            cid
          }))
        } else if (evt.type === 'bitswap:block') {
          options.onProgress(new CustomProgressEvent<BlockBrokerReceiveBlockProgressEvent>('helia:block-broker:receive-block', {
            broker: 'bitswap',
            type: 'receive-block',
            provider: evt.detail.sender,
            cid
          }))
        }
      }
    })
  }

  createSession (options?: CreateSessionOptions<BitswapWantBlockProgressEvents>): SessionBlockBroker<BitswapWantBlockProgressEvents, BitswapNotifyProgressEvents> {
    const session = this.bitswap.createSession(options)

    return {
      name: 'bitswap-session',

      addPeer: async (peer, options) => {
        await session.addPeer(peer, options)
      },

      announce: async (cid, options) => {
        await this.bitswap.notify(cid, options)
      },

      retrieve: async (cid, options) => {
        return session.retrieve(cid, options)
      }
    }
  }
}

/**
 * A helper factory for users who want to override Helia `blockBrokers` but
 * still want to use the default `BitswapBlockBroker`.
 */
export function bitswap (init: BitswapBlockBrokerInit = {}): (components: BitswapBlockBrokerComponents) => BlockBroker {
  return (components) => new BitswapBlockBroker(components, init)
}
