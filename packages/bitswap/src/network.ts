import { CodeError, TypedEventEmitter, setMaxListeners } from '@libp2p/interface'
import { PeerQueue, type PeerQueueJobOptions } from '@libp2p/utils/peer-queue'
import { Circuit } from '@multiformats/multiaddr-matcher'
import { anySignal } from 'any-signal'
import debug from 'debug'
import drain from 'it-drain'
import * as lp from 'it-length-prefixed'
import { lpStream } from 'it-length-prefixed-stream'
import map from 'it-map'
import { pipe } from 'it-pipe'
import take from 'it-take'
import { base64 } from 'multiformats/bases/base64'
import { CID } from 'multiformats/cid'
import { CustomProgressEvent } from 'progress-events'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { BITSWAP_120, DEFAULT_MAX_INBOUND_STREAMS, DEFAULT_MAX_OUTBOUND_STREAMS, DEFAULT_MAX_PROVIDERS_PER_REQUEST, DEFAULT_MESSAGE_RECEIVE_TIMEOUT, DEFAULT_MESSAGE_SEND_TIMEOUT, DEFAULT_RUN_ON_TRANSIENT_CONNECTIONS } from './constants.js'
import { BitswapMessage } from './pb/message.js'
import type { WantOptions } from './bitswap.js'
import type { MultihashHasherLoader } from './index.js'
import type { Block, BlockPresence, WantlistEntry } from './pb/message.js'
import type { Provider, Routing } from '@helia/interface'
import type { Libp2p, AbortOptions, Connection, PeerId, IncomingStreamData, Topology, MetricGroup, ComponentLogger, Metrics } from '@libp2p/interface'
import type { Logger } from '@libp2p/logger'
import type { ProgressEvent, ProgressOptions } from 'progress-events'

// Add a formatter for a bitswap message
debug.formatters.B = (b?: BitswapMessage): string => {
  if (b == null) {
    return 'undefined'
  }

  return JSON.stringify({
    blocks: b.blocks?.map(b => ({
      data: `${uint8ArrayToString(b.data, 'base64').substring(0, 10)}...`,
      prefix: uint8ArrayToString(b.prefix, 'base64')
    })),
    blockPresences: b.blockPresences?.map(p => ({
      ...p,
      cid: CID.decode(p.cid).toString()
    })),
    wantlist: b.wantlist == null
      ? undefined
      : {
          full: b.wantlist.full,
          entries: b.wantlist.entries.map(e => ({
            ...e,
            cid: CID.decode(e.cid).toString()
          }))
        }
  }, null, 2)
}

export type BitswapNetworkProgressEvents =
  ProgressEvent<'bitswap:network:dial', PeerId>

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
  messageSendTimeout?: number
  messageSendConcurrency?: number
  protocols?: string[]
  runOnTransientConnections?: boolean
}

export interface NetworkComponents {
  routing: Routing
  logger: ComponentLogger
  libp2p: Libp2p
  metrics?: Metrics
}

export interface NetworkEvents {
  'bitswap:message': CustomEvent<{ peer: PeerId, message: BitswapMessage }>
  'peer:connected': CustomEvent<PeerId>
  'peer:disconnected': CustomEvent<PeerId>
}

interface SendMessageJobOptions extends AbortOptions, ProgressOptions, PeerQueueJobOptions {
  message: BitswapMessage
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
  private readonly metrics?: { blocksSent: MetricGroup, dataSent: MetricGroup }
  private readonly sendQueue: PeerQueue<void, SendMessageJobOptions>
  private readonly messageSendTimeout: number
  private readonly runOnTransientConnections: boolean

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
    this.messageSendTimeout = init.messageSendTimeout ?? DEFAULT_MESSAGE_SEND_TIMEOUT
    this.runOnTransientConnections = init.runOnTransientConnections ?? DEFAULT_RUN_ON_TRANSIENT_CONNECTIONS

    if (components.metrics != null) {
      this.metrics = {
        blocksSent: components.metrics?.registerMetricGroup('ipfs_bitswap_sent_blocks'),
        dataSent: components.metrics?.registerMetricGroup('ipfs_bitswap_sent_data_bytes')
      }
    }

    this.sendQueue = new PeerQueue({
      concurrency: init.messageSendConcurrency,
      metrics: components.metrics,
      metricName: 'ipfs_bitswap_message_send_queue'
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
      runOnTransientConnection: this.runOnTransientConnections
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
        stream.abort(new CodeError('Incoming Bitswap stream timed out', 'ERR_TIMEOUT'))
      }

      let signal = AbortSignal.timeout(this.messageReceiveTimeout)
      setMaxListeners(Infinity, signal)
      signal.addEventListener('abort', abortListener)

      await pipe(
        stream,
        (source) => lp.decode(source),
        async (source) => {
          for await (const data of source) {
            try {
              const message = BitswapMessage.decode(data)
              this.log('incoming new bitswap %s message from %p %B', stream.protocol, connection.remotePeer, message)

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
              this.log.error('error reading incoming bitswap message from %p', connection.remotePeer, err)
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
   * Find providers given a `cid`.
   */
  async * findProviders (cid: CID, options?: AbortOptions & ProgressOptions<BitswapNetworkWantProgressEvents>): AsyncIterable<Provider> {
    options?.onProgress?.(new CustomProgressEvent<PeerId>('bitswap:network:find-providers', cid))

    for await (const provider of this.routing.findProviders(cid, options)) {
      // unless we explicitly run on transient connections, skip peers that only
      // have circuit relay addresses as bitswap won't run over them
      if (!this.runOnTransientConnections) {
        let hasDirectAddress = false

        for (let ma of provider.multiaddrs) {
          if (ma.getPeerId() === null) {
            ma = ma.encapsulate(`/p2p/${provider.id}`)
          }

          if (!Circuit.exactMatch(ma)) {
            hasDirectAddress = true
            break
          }
        }

        if (!hasDirectAddress) {
          continue
        }
      }

      yield provider
    }
  }

  /**
   * Find the providers of a given `cid` and connect to them.
   */
  async findAndConnect (cid: CID, options?: WantOptions): Promise<void> {
    await drain(
      take(
        map(this.findProviders(cid, options), async provider => this.connectTo(provider.id, options)
          .catch(err => {
            // Prevent unhandled promise rejection
            this.log.error(err)
          })),
        options?.maxProviders ?? DEFAULT_MAX_PROVIDERS_PER_REQUEST
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
  async sendMessage (peerId: PeerId, msg: Partial<BitswapMessage>, options?: AbortOptions & ProgressOptions<BitswapNetworkWantProgressEvents>): Promise<void> {
    if (!this.running) {
      throw new Error('network isn\'t running')
    }

    const message: BitswapMessage = {
      wantlist: {
        full: msg.wantlist?.full ?? false,
        entries: msg.wantlist?.entries ?? []
      },
      blocks: msg.blocks ?? [],
      blockPresences: msg.blockPresences ?? [],
      pendingBytes: msg.pendingBytes ?? 0
    }

    const signal = anySignal([AbortSignal.timeout(this.messageSendTimeout), options?.signal])
    setMaxListeners(Infinity, signal)

    try {
      const existingJob = this.sendQueue.find(peerId)

      if (existingJob?.status === 'queued') {
        // merge messages instead of adding new job
        existingJob.options.message = mergeMessages(existingJob.options.message, message)

        await existingJob.join({
          signal
        })

        return
      }

      await this.sendQueue.add(async (options) => {
        const message = options?.message

        if (message == null) {
          throw new CodeError('No message to send', 'ERR_NO_MESSAGE')
        }

        this.log('sendMessage to %p %B', peerId, message)

        options?.onProgress?.(new CustomProgressEvent<PeerId>('bitswap:network:send-wantlist', peerId))

        const stream = await this.libp2p.dialProtocol(peerId, BITSWAP_120, options)

        try {
          const lp = lpStream(stream)
          await lp.write(BitswapMessage.encode(message), options)
          await lp.unwrap().close(options)
        } catch (err: any) {
          options?.onProgress?.(new CustomProgressEvent<{ peer: PeerId, error: Error }>('bitswap:network:send-wantlist:error', { peer: peerId, error: err }))
          this.log.error('error sending message to %p', peerId, err)
          stream.abort(err)
        }

        this._updateSentStats(peerId, message.blocks)
      }, {
        peerId,
        signal,
        message
      })
    } finally {
      signal.clear()
    }
  }

  /**
   * Connects to another peer
   */
  async connectTo (peer: PeerId, options?: AbortOptions & ProgressOptions<BitswapNetworkProgressEvents>): Promise<Connection> { // eslint-disable-line require-await
    if (!this.running) {
      throw new CodeError('Network isn\'t running', 'ERR_NOT_STARTED')
    }

    options?.onProgress?.(new CustomProgressEvent<PeerId>('bitswap:network:dial', peer))
    return this.libp2p.dial(peer, options)
  }

  _updateSentStats (peerId: PeerId, blocks: Block[] = []): void {
    if (this.metrics != null) {
      let bytes = 0

      for (const block of blocks.values()) {
        bytes += block.data.byteLength
      }

      this.metrics.dataSent.increment({
        global: bytes,
        [peerId.toString()]: bytes
      })
      this.metrics.blocksSent.increment({
        global: blocks.length,
        [peerId.toString()]: blocks.length
      })
    }
  }
}

function mergeMessages (messageA: BitswapMessage, messageB: BitswapMessage): BitswapMessage {
  const wantListEntries = new Map<string, WantlistEntry>(
    (messageA.wantlist?.entries ?? []).map(entry => ([
      base64.encode(entry.cid),
      entry
    ]))
  )

  for (const entry of messageB.wantlist?.entries ?? []) {
    const key = base64.encode(entry.cid)
    const existingEntry = wantListEntries.get(key)

    if (existingEntry != null) {
      // take highest priority
      if (existingEntry.priority > entry.priority) {
        entry.priority = existingEntry.priority
      }

      // take later values if passed, otherwise use earlier ones
      entry.cancel = entry.cancel ?? existingEntry.cancel
      entry.wantType = entry.wantType ?? existingEntry.wantType
      entry.sendDontHave = entry.sendDontHave ?? existingEntry.sendDontHave
    }

    wantListEntries.set(key, entry)
  }

  const blockPresences = new Map<string, BlockPresence>(
    messageA.blockPresences.map(presence => ([
      base64.encode(presence.cid),
      presence
    ]))
  )

  for (const blockPresence of messageB.blockPresences) {
    const key = base64.encode(blockPresence.cid)

    // override earlier block presence with later one as if duplicated it is
    // likely to be more accurate since it is more recent
    blockPresences.set(key, blockPresence)
  }

  const blocks = new Map<string, Block>(
    messageA.blocks.map(block => ([
      base64.encode(block.data),
      block
    ]))
  )

  for (const block of messageB.blocks) {
    const key = base64.encode(block.data)

    blocks.set(key, block)
  }

  const output: BitswapMessage = {
    wantlist: {
      full: messageA.wantlist?.full ?? messageB.wantlist?.full ?? false,
      entries: [...wantListEntries.values()]
    },
    blockPresences: [...blockPresences.values()],
    blocks: [...blocks.values()],
    pendingBytes: messageA.pendingBytes + messageB.pendingBytes
  }

  return output
}
