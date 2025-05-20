import { InvalidParametersError, NotStartedError, TimeoutError, TypedEventEmitter, UnsupportedProtocolError, setMaxListeners } from '@libp2p/interface'
import { PeerQueue } from '@libp2p/utils/peer-queue'
import drain from 'it-drain'
import * as lp from 'it-length-prefixed'
import map from 'it-map'
import { pipe } from 'it-pipe'
import take from 'it-take'
import { CustomProgressEvent } from 'progress-events'
import { raceEvent } from 'race-event'
import { BITSWAP_120, DEFAULT_MAX_INBOUND_STREAMS, DEFAULT_MAX_INCOMING_MESSAGE_SIZE, DEFAULT_MAX_OUTBOUND_STREAMS, DEFAULT_MAX_OUTGOING_MESSAGE_SIZE, DEFAULT_MAX_PROVIDERS_PER_REQUEST, DEFAULT_MESSAGE_RECEIVE_TIMEOUT, DEFAULT_MESSAGE_SEND_CONCURRENCY, DEFAULT_RUN_ON_TRANSIENT_CONNECTIONS } from './constants.js'
import { BitswapMessage } from './pb/message.js'
import { mergeMessages } from './utils/merge-messages.js'
import { splitMessage } from './utils/split-message.js'
import type { WantOptions } from './bitswap.js'
import type { MultihashHasherLoader } from './index.js'
import type { Block } from './pb/message.js'
import type { QueuedBitswapMessage } from './utils/bitswap-message.js'
import type { Provider, Routing } from '@helia/interface/routing'
import type { Libp2p, AbortOptions, Connection, PeerId, IncomingStreamData, Topology, ComponentLogger, IdentifyResult, Counter, Metrics } from '@libp2p/interface'
import type { Logger } from '@libp2p/logger'
import type { PeerQueueJobOptions } from '@libp2p/utils/peer-queue'
import type { Multiaddr } from '@multiformats/multiaddr'
import type { CID } from 'multiformats/cid'
import type { ProgressEvent, ProgressOptions } from 'progress-events'

export type BitswapNetworkProgressEvents =
  ProgressEvent<'bitswap:network:dial', PeerId | Multiaddr | Multiaddr[]>

export type BitswapNetworkWantProgressEvents =
  ProgressEvent<'bitswap:network:send-wantlist', PeerId> |
  ProgressEvent<'bitswap:network:send-wantlist:error', { peer: PeerId, error: Error }> |
  ProgressEvent<'bitswap:network:find-providers', CID> |
  BitswapNetworkProgressEvents

export type BitswapNetworkNotifyProgressEvents =
  BitswapNetworkProgressEvents |
  ProgressEvent<'bitswap:network:send-block', PeerId>

export interface NetworkInit {
  hashLoader?: MultihashHasherLoader
  maxInboundStreams?: number
  maxOutboundStreams?: number
  messageReceiveTimeout?: number
  messageSendConcurrency?: number
  protocols?: string[]
  runOnLimitedConnections?: boolean
  maxOutgoingMessageSize?: number
  maxIncomingMessageSize?: number
}

export interface NetworkComponents {
  routing: Routing
  logger: ComponentLogger
  libp2p: Libp2p
  metrics?: Metrics
}

export interface BitswapMessageEventDetail {
  peer: PeerId
  message: BitswapMessage
}

export interface NetworkEvents {
  'bitswap:message': CustomEvent<{ peer: PeerId, message: BitswapMessage }>
  'peer:connected': CustomEvent<PeerId>
  'peer:disconnected': CustomEvent<PeerId>
}

interface SendMessageJobOptions extends AbortOptions, ProgressOptions, PeerQueueJobOptions {
  message: QueuedBitswapMessage
}

export class Network extends TypedEventEmitter<NetworkEvents> {
  private readonly log: Logger
  private readonly libp2p: Libp2p
  private readonly routing: Routing
  private readonly protocols: string[]
  private running: boolean
  private readonly maxInboundStreams: number
  private readonly maxOutboundStreams: number
  private readonly messageReceiveTimeout: number
  private registrarIds: string[]
  private readonly metrics: { blocksSent?: Counter, dataSent?: Counter }
  private readonly sendQueue: PeerQueue<void, SendMessageJobOptions>
  private readonly runOnLimitedConnections: boolean
  private readonly maxOutgoingMessageSize: number
  private readonly maxIncomingMessageSize: number

  constructor (components: NetworkComponents, init: NetworkInit = {}) {
    super()

    this.log = components.logger.forComponent('helia:bitswap:network')
    this.libp2p = components.libp2p
    this.routing = components.routing
    this.protocols = init.protocols ?? [BITSWAP_120]
    this.registrarIds = []
    this.running = false

    // bind event listeners
    this._onStream = this._onStream.bind(this)
    this.maxInboundStreams = init.maxInboundStreams ?? DEFAULT_MAX_INBOUND_STREAMS
    this.maxOutboundStreams = init.maxOutboundStreams ?? DEFAULT_MAX_OUTBOUND_STREAMS
    this.messageReceiveTimeout = init.messageReceiveTimeout ?? DEFAULT_MESSAGE_RECEIVE_TIMEOUT
    this.runOnLimitedConnections = init.runOnLimitedConnections ?? DEFAULT_RUN_ON_TRANSIENT_CONNECTIONS
    this.maxIncomingMessageSize = init.maxIncomingMessageSize ?? DEFAULT_MAX_OUTGOING_MESSAGE_SIZE
    this.maxOutgoingMessageSize = init.maxOutgoingMessageSize ?? init.maxIncomingMessageSize ?? DEFAULT_MAX_INCOMING_MESSAGE_SIZE
    this.metrics = {
      blocksSent: components.metrics?.registerCounter('helia_bitswap_sent_blocks_total'),
      dataSent: components.metrics?.registerCounter('helia_bitswap_sent_data_bytes_total')
    }

    this.sendQueue = new PeerQueue({
      concurrency: init.messageSendConcurrency ?? DEFAULT_MESSAGE_SEND_CONCURRENCY,
      metrics: components.metrics,
      metricName: 'helia_bitswap_message_send_queue'
    })
    this.sendQueue.addEventListener('error', (evt) => {
      this.log.error('error sending wantlist to peer', evt.detail)
    })
  }

  async start (): Promise<void> {
    if (this.running) {
      return
    }

    this.running = true

    await this.libp2p.handle(this.protocols, this._onStream, {
      maxInboundStreams: this.maxInboundStreams,
      maxOutboundStreams: this.maxOutboundStreams,
      runOnLimitedConnection: this.runOnLimitedConnections
    })

    // register protocol with topology
    const topology: Topology = {
      onConnect: (peerId: PeerId) => {
        this.safeDispatchEvent('peer:connected', {
          detail: peerId
        })
      },
      onDisconnect: (peerId: PeerId) => {
        this.safeDispatchEvent('peer:disconnected', {
          detail: peerId
        })
      }
    }

    this.registrarIds = []

    for (const protocol of this.protocols) {
      this.registrarIds.push(await this.libp2p.register(protocol, topology))
    }

    // All existing connections are like new ones for us
    this.libp2p.getConnections().forEach(conn => {
      this.safeDispatchEvent('peer:connected', {
        detail: conn.remotePeer
      })
    })
  }

  async stop (): Promise<void> {
    this.running = false

    // Unhandle both, libp2p doesn't care if it's not already handled
    await this.libp2p.unhandle(this.protocols)

    // unregister protocol and handlers
    if (this.registrarIds != null) {
      for (const id of this.registrarIds) {
        this.libp2p.unregister(id)
      }

      this.registrarIds = []
    }
  }

  /**
   * Handles incoming bitswap messages
   */
  _onStream (info: IncomingStreamData): void {
    if (!this.running) {
      return
    }

    const { stream, connection } = info

    Promise.resolve().then(async () => {
      this.log('incoming new bitswap %s stream from %p', stream.protocol, connection.remotePeer)
      const abortListener = (): void => {
        if (stream.status === 'open') {
          stream.abort(new TimeoutError(`Incoming Bitswap stream timed out after ${this.messageReceiveTimeout}ms`))
        } else {
          this.log('stream aborted with status %s', stream.status)
        }
      }

      let signal = AbortSignal.timeout(this.messageReceiveTimeout)
      setMaxListeners(Infinity, signal)
      signal.addEventListener('abort', abortListener)

      await stream.closeWrite()

      await pipe(
        stream,
        (source) => lp.decode(source, {
          maxDataLength: this.maxIncomingMessageSize
        }),
        async (source) => {
          for await (const data of source) {
            try {
              const message = BitswapMessage.decode(data)
              this.log('incoming new bitswap %s message from %p on stream', stream.protocol, connection.remotePeer, stream.id)

              this.safeDispatchEvent('bitswap:message', {
                detail: {
                  peer: connection.remotePeer,
                  message
                }
              })

              // we have received some data so reset the timeout controller
              signal.removeEventListener('abort', abortListener)
              signal = AbortSignal.timeout(this.messageReceiveTimeout)
              setMaxListeners(Infinity, signal)
              signal.addEventListener('abort', abortListener)
            } catch (err: any) {
              this.log.error('error reading incoming bitswap message from %p on stream', connection.remotePeer, stream.id, err)
              stream.abort(err)
              break
            }
          }
        }
      )
    })
      .catch(err => {
        this.log.error('error handling incoming stream from %p', connection.remotePeer, err)
        stream.abort(err)
      })
  }

  /**
   * Find bitswap providers for a given `cid`.
   */
  async * findProviders (cid: CID, options?: AbortOptions & ProgressOptions<BitswapNetworkWantProgressEvents>): AsyncIterable<Provider> {
    options?.onProgress?.(new CustomProgressEvent<CID>('bitswap:network:find-providers', cid))

    for await (const provider of this.routing.findProviders(cid, options)) {
      // make sure we can dial the provider
      const dialable = await this.libp2p.isDialable(provider.multiaddrs, {
        runOnLimitedConnection: this.runOnLimitedConnections
      })

      if (!dialable) {
        continue
      }

      yield provider
    }
  }

  /**
   * Find the providers of a given `cid` and connect to them.
   */
  async findAndConnect (cid: CID, options?: WantOptions): Promise<void> {
    // connect to initial session providers if supplied
    if (options?.providers != null) {
      await Promise.all(
        options.providers.map(async prov => this.connectTo(prov)
          .catch(err => {
            this.log.error('could not connect to supplied provider - %e', err)
          }))
      )
    }

    // make a routing query to find additional providers
    await drain(
      map(
        take(this.findProviders(cid, options), options?.maxProviders ?? DEFAULT_MAX_PROVIDERS_PER_REQUEST),
        async provider => this.connectTo(provider.id, options)
      )
    )
      .catch(err => {
        this.log.error(err)
      })
  }

  /**
   * Connect to the given peer
   * Send the given msg (instance of Message) to the given peer
   */
  async sendMessage (peerId: PeerId, message: QueuedBitswapMessage, options?: AbortOptions & ProgressOptions<BitswapNetworkWantProgressEvents>): Promise<void> {
    if (!this.running) {
      throw new Error('network isn\'t running')
    }

    const existingJob = this.sendQueue.queue.find(job => {
      return peerId.equals(job.options.peerId) && job.status === 'queued'
    })

    if (existingJob != null) {
      existingJob.options.message = mergeMessages(existingJob.options.message, message)

      await existingJob.join({
        signal: options?.signal
      })

      return
    }

    await this.sendQueue.add(async (options) => {
      const message = options?.message

      if (message == null) {
        throw new InvalidParametersError('No message to send')
      }

      this.log('sendMessage to %p', peerId)

      options?.onProgress?.(new CustomProgressEvent<PeerId>('bitswap:network:send-wantlist', peerId))

      const stream = await this.libp2p.dialProtocol(peerId, BITSWAP_120, options)
      await stream.closeRead()

      try {
        await pipe(
          splitMessage(message, this.maxOutgoingMessageSize),
          (source) => lp.encode(source),
          stream
        )

        await stream.close(options)
      } catch (err: any) {
        options?.onProgress?.(new CustomProgressEvent<{ peer: PeerId, error: Error }>('bitswap:network:send-wantlist:error', { peer: peerId, error: err }))
        this.log.error('error sending message to %p', peerId, err)
        stream.abort(err)
      }

      this._updateSentStats(message.blocks)
    }, {
      peerId,
      signal: options?.signal,
      message
    })
  }

  /**
   * Connects to another peer
   */
  async connectTo (peer: PeerId | Multiaddr | Multiaddr[], options?: AbortOptions & ProgressOptions<BitswapNetworkProgressEvents>): Promise<Connection> {
    if (!this.running) {
      throw new NotStartedError('Network isn\'t running')
    }

    options?.onProgress?.(new CustomProgressEvent<PeerId | Multiaddr | Multiaddr[]>('bitswap:network:dial', peer))

    // dial and wait for identify - this is to avoid opening a protocol stream
    // that we are not going to use but depends on the remote node running the
    // identify protocol
    const [
      connection
    ] = await Promise.all([
      this.libp2p.dial(peer, options),
      raceEvent(this.libp2p, 'peer:identify', options?.signal, {
        filter: (evt: CustomEvent<IdentifyResult>): boolean => {
          if (!evt.detail.peerId.equals(peer)) {
            return false
          }

          if (evt.detail.protocols.includes(BITSWAP_120)) {
            return true
          }

          throw new UnsupportedProtocolError(`${peer} did not support ${BITSWAP_120}`)
        }
      })
    ])

    return connection
  }

  _updateSentStats (blocks: Map<string, Block>): void {
    let bytes = 0

    for (const block of blocks.values()) {
      bytes += block.data.byteLength
    }

    this.metrics.dataSent?.increment(bytes)
    this.metrics.blocksSent?.increment(blocks.size)
  }
}
