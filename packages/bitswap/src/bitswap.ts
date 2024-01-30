/* eslint-disable no-loop-func */
import { setMaxListeners } from '@libp2p/interface'
import { PeerSet } from '@libp2p/peer-collections'
import { PeerQueue } from '@libp2p/utils/peer-queue'
import { anySignal } from 'any-signal'
import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import pDefer from 'p-defer'
import { CodeError } from 'protons-runtime'
import { raceSignal } from 'race-signal'
import { DEFAULT_MAX_PROVIDERS_PER_REQUEST, DEFAULT_MIN_PROVIDERS_BEFORE_SESSION_READY, DEFAULT_SESSION_QUERY_CONCURRENCY, DEFAULT_SESSION_ROOT_PRIORITY } from './constants.js'
import { Network } from './network.js'
import { Notifications, receivedBlockEvent, type ReceivedBlockListener, type HaveBlockListener, haveEvent, type DoNotHaveBlockListener, doNotHaveEvent } from './notifications.js'
import { BlockPresenceType, WantType } from './pb/message.js'
import { PeerWantLists } from './peer-want-lists/index.js'
import { createBitswapSession } from './session.js'
import { Stats } from './stats.js'
import vd from './utils/varint-decoder.js'
import { WantList } from './want-list.js'
import type { BitswapOptions, Bitswap as BitswapInterface, MultihashHasherLoader, BitswapWantProgressEvents, BitswapNotifyProgressEvents, BitswapSession, WantListEntry, CreateSessionOptions, BitswapComponents } from './index.js'
import type { BitswapMessage } from './pb/message.js'
import type { ComponentLogger, Libp2p, PeerId } from '@libp2p/interface'
import type { Logger } from '@libp2p/logger'
import type { AbortOptions } from '@multiformats/multiaddr'
import type { Blockstore } from 'interface-blockstore'
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
  public notifications: Notifications
  public status: 'starting' | 'started' | 'stopping' | 'stopped'
  private readonly hashLoader?: MultihashHasherLoader

  private readonly libp2p: Libp2p

  constructor (components: BitswapComponents, init: BitswapOptions = {}) {
    this.logger = components.logger
    this.log = components.logger.forComponent('bitswap')
    this.status = 'stopped'
    this.libp2p = components.libp2p
    this.blockstore = components.blockstore
    this.hashLoader = init.hashLoader

    // report stats to libp2p metrics
    this.stats = new Stats(components)

    // the network delivers messages
    this.network = new Network(components, init)
    this.network.addEventListener('bitswap:message', evt => {
      this._receiveMessage(evt.detail.peer, evt.detail.message)
        .catch(err => {
          this.log.error('error receiving bitswap message from %p', evt.detail.peer, err)
        })
    })
    this.network.addEventListener('peer:connected', evt => {
      this.wantList.connected(evt.detail)
        .catch(err => {
          this.log.error('error processing newly connected bitswap peer %p', evt.detail, err)
        })
    })
    this.network.addEventListener('peer:disconnected', evt => {
      this.wantList.disconnected(evt.detail)
      this.peerWantLists.peerDisconnected(evt.detail)
    })

    // handle which blocks we send to peers
    this.peerWantLists = new PeerWantLists({
      ...components,
      network: this.network
    }, init)

    // handle which blocks we ask peers for
    this.wantList = new WantList({
      ...components,
      network: this.network
    })

    // event emitter that lets sessions/want promises know blocks have arrived
    this.notifications = new Notifications(components)
  }

  /**
   * handle messages received through the network
   */
  async _receiveMessage (peerId: PeerId, message: BitswapMessage): Promise<void> {
    // hash all incoming blocks
    const received = await Promise.all(
      message.blocks
        .filter(block => block.prefix != null && block.data != null)
        .map(async block => {
          const values = vd(block.prefix)
          const cidVersion = values[0]
          const multicodec = values[1]
          const hashAlg = values[2]
          // const hashLen = values[3] // We haven't need to use this so far

          const hasher = hashAlg === sha256.code ? sha256 : await this.hashLoader?.getHasher(hashAlg)

          if (hasher == null) {
            throw new CodeError('Unknown hash algorithm', 'ERR_UNKNOWN_HASH_ALG')
          }

          const hash = await hasher.digest(block.data)
          const cid = CID.create(cidVersion === 0 ? 0 : 1, multicodec, hash)
          const wasWanted = this.notifications.listenerCount(receivedBlockEvent(cid)) > 0

          return { wasWanted, cid, data: block.data }
        })
    )

    // quickly send out cancels, reduces chances of duplicate block receives
    if (received.length > 0) {
      this.wantList.cancelWants(
        received
          .filter(({ wasWanted }) => wasWanted)
          .map(({ cid }) => cid)
      ).catch(err => {
        this.log.error('error sending block cancels', err)
      })
    }

    // notify sessions of block haves/don't haves
    for (const { cid: cidBytes, type } of message.blockPresences) {
      const cid = CID.decode(cidBytes)

      if (type === BlockPresenceType.HaveBlock) {
        this.notifications.haveBlock(cid, peerId)
      } else {
        this.notifications.doNotHaveBlock(cid, peerId)
      }
    }

    await Promise.all(
      received.map(
        async ({ cid, wasWanted, data }) => {
          await this._handleReceivedBlock(peerId, cid, data, wasWanted)
          this.notifications.receivedBlock(cid, data, peerId)
        }
      )
    )

    try {
      // Note: this allows the engine to respond to any wants in the message.
      // Processing of the blocks in the message happens below, after the
      // blocks have been added to the blockstore.
      await this.peerWantLists.messageReceived(peerId, message)
    } catch (err) {
      // Log instead of throwing an error so as to process as much as
      // possible of the message. Currently `messageReceived` does not
      // throw any errors, but this could change in the future.
      this.log('failed to receive message from %p', peerId, message)
    }
  }

  private async _handleReceivedBlock (peerId: PeerId, cid: CID, data: Uint8Array, wasWanted: boolean): Promise<void> {
    this.log('received block')

    const has = await this.blockstore.has(cid)

    this._updateReceiveCounters(peerId, cid, data, has)

    if (!wasWanted || has) {
      return
    }

    await this.blockstore.put(cid, data)
  }

  _updateReceiveCounters (peerId: PeerId, cid: CID, data: Uint8Array, exists: boolean): void {
    this.stats.updateBlocksReceived(1, peerId)
    this.stats.updateDataReceived(data.byteLength, peerId)

    if (exists) {
      this.stats.updateDuplicateBlocksReceived(1, peerId)
      this.stats.updateDuplicateDataReceived(data.byteLength, peerId)
    }
  }

  async createSession (root: CID, options?: CreateSessionOptions): Promise<BitswapSession> {
    const minProviders = options?.minProviders ?? DEFAULT_MIN_PROVIDERS_BEFORE_SESSION_READY
    const maxProviders = options?.maxProviders ?? DEFAULT_MAX_PROVIDERS_PER_REQUEST

    // normalize to v1 CID
    root = root.toV1()

    const deferred = pDefer<BitswapSession>()
    const session = createBitswapSession({
      notifications: this.notifications,
      wantList: this.wantList,
      network: this.network,
      logger: this.logger
    }, {
      root
    })

    let peerDoesNotHave = 0
    let searchedForProviders = false

    const queue = new PeerQueue({
      concurrency: options?.queryConcurrency ?? DEFAULT_SESSION_QUERY_CONCURRENCY
    })
    queue.addEventListener('error', (err) => {
      this.log.error('error querying peer for %c', root, err)
    })
    queue.addEventListener('completed', () => {
      if (session.peers.size === maxProviders) {
        this.notifications.removeListener(receivedBlockEvent(root), receivedBlockListener)
        this.notifications.removeListener(haveEvent(root), haveBlockListener)
        this.notifications.removeListener(doNotHaveEvent(root), doNotHaveBlockListener)
      }

      queue.clear()
    })

    const queriedPeers = new PeerSet()
    const existingPeers = new PeerSet()
    const providerPeers = new PeerSet()

    // register for peer responses
    const receivedBlockListener: ReceivedBlockListener = (block, peer): void => {
      this.log('adding %p to session after receiving block when asking for HAVE_BLOCK', peer)
      session.peers.add(peer)

      // check if the session can be used now
      if (session.peers.size === minProviders) {
        deferred.resolve(session)
      }
    }
    const haveBlockListener: HaveBlockListener = (peer): void => {
      this.log('adding %p to session after receiving HAVE_BLOCK', peer)
      session.peers.add(peer)

      // check if the session can be used now
      if (session.peers.size === minProviders) {
        deferred.resolve(session)
      }

      if (session.peers.size === maxProviders) {
        this.notifications.removeListener(receivedBlockEvent(root), receivedBlockListener)
        this.notifications.removeListener(haveEvent(root), haveBlockListener)
        this.notifications.removeListener(doNotHaveEvent(root), doNotHaveBlockListener)
      }
    }
    const doNotHaveBlockListener: DoNotHaveBlockListener = (peer) => {
      peerDoesNotHave++

      if (searchedForProviders && peerDoesNotHave === queriedPeers.size) {
        // no queried peers can supply the root block
        deferred.reject(new CodeError(`No peers or providers had ${root}`, 'ERR_NO_PROVIDERS_FOUND'))
      }
    }

    this.notifications.addListener(receivedBlockEvent(root), receivedBlockListener)
    this.notifications.addListener(haveEvent(root), haveBlockListener)
    this.notifications.addListener(doNotHaveEvent(root), doNotHaveBlockListener)

    if (options?.queryConnectedPeers !== false) {
      // ask our current bitswap peers for the CID
      await Promise.all([
        ...this.wantList.peers.keys()
      ].map(async (peerId) => {
        if (queriedPeers.has(peerId)) {
          return
        }

        existingPeers.add(peerId)

        await queue.add(async () => {
          try {
            await this.network.sendMessage(peerId, {
              wantlist: {
                entries: [{
                  cid: root.bytes,
                  priority: options?.priority ?? DEFAULT_SESSION_ROOT_PRIORITY,
                  wantType: WantType.WantHave,
                  sendDontHave: true
                }]
              }
            }, options)

            queriedPeers.add(peerId)
          } catch (err: any) {
            this.log.error('error querying connected peer %p for initial session', peerId, err)
          }
        }, {
          peerId
        })
      }))

      this.log.trace('creating session queried %d connected peers for %c', queriedPeers, root)
    }

    // find network providers too but do not wait for the query to complete
    void Promise.resolve().then(async () => {
      let providers = 0

      for await (const provider of this.network.findProviders(root, options)) {
        providers++

        if (queriedPeers.has(provider.id)) {
          continue
        }

        await queue.add(async () => {
          try {
            await this.network.sendMessage(provider.id, {
              wantlist: {
                entries: [{
                  cid: root.bytes,
                  priority: options?.priority ?? DEFAULT_SESSION_ROOT_PRIORITY,
                  wantType: WantType.WantHave,
                  sendDontHave: true
                }]
              }
            }, options)

            providerPeers.add(provider.id)
            queriedPeers.add(provider.id)
          } catch (err: any) {
            this.log.error('error querying provider %p for initial session', provider.id, err.errors ?? err)
          }
        }, {
          peerId: provider.id
        })

        if (session.peers.size === maxProviders) {
          break
        }
      }

      this.log.trace('creating session found %d providers for %c', providers, root)

      searchedForProviders = true

      // we have no peers and could find no providers
      if (providers === 0) {
        deferred.reject(new CodeError(`Could not find providers for ${root}`, 'ERR_NO_PROVIDERS_FOUND'))
      }
    })
      .catch(err => {
        this.log.error('error querying providers for %c', root, err)
      })
      .finally(() => {
        if (peerDoesNotHave === queriedPeers.size) {
          // no queried peers can supply the root block
          deferred.reject(new CodeError(`No peers or providers had ${root}`, 'ERR_NO_PROVIDERS_FOUND'))
        }
      })

    return raceSignal(deferred.promise, options?.signal)
  }

  async want (cid: CID, options: WantOptions = {}): Promise<Uint8Array> {
    const loadOrFetchFromNetwork = async (cid: CID, wantBlockPromise: Promise<Uint8Array>, options: WantOptions): Promise<Uint8Array> => {
      try {
        // have to await here as we want to handle ERR_NOT_FOUND from the
        // blockstore
        return await Promise.race([
          this.blockstore.get(cid, options),
          wantBlockPromise
        ])
      } catch (err: any) {
        if (err.code !== 'ERR_NOT_FOUND') {
          throw err
        }

        // add the block to the wantlist
        this.wantList.wantBlocks([cid])
          .catch(err => {
            this.log.error('error adding %c to wantlist', cid, err)
          })

        // find providers and connect to them
        this.network.findAndConnect(cid, options)
          .catch(err => {
            this.log.error('could not find and connect for cid %c', cid, err)
          })

        return wantBlockPromise
      }
    }

    // it's possible for blocks to come in while we do the async operations to
    // get them from the blockstore leading to a race condition, so register for
    // incoming block notifications as well as trying to get it from the
    // datastore
    const controller = new AbortController()
    setMaxListeners(Infinity, controller.signal)
    const signal = anySignal([controller.signal, options.signal])

    try {
      const wantBlockPromise = this.notifications.wantBlock(cid, {
        ...options,
        signal
      })

      const block = await Promise.race([
        wantBlockPromise,
        loadOrFetchFromNetwork(cid, wantBlockPromise, {
          ...options,
          signal
        })
      ])

      return block
    } catch (err: any) {
      if (err.code === 'ERR_ABORTED') {
        // the want was cancelled, send out cancel messages
        await this.wantList.cancelWants([cid])
      }

      throw err
    } finally {
      // since we have the block we can now abort any outstanding attempts to
      // fetch it
      controller.abort()
      signal.clear()

      this.wantList.unwantBlocks([cid])
    }
  }

  /**
   * Sends notifications about the arrival of a block
   */
  async notify (cid: CID, block: Uint8Array, options: ProgressOptions<BitswapNotifyProgressEvents> & AbortOptions = {}): Promise<void> {
    this.notifications.receivedBlock(cid, block, this.libp2p.peerId)

    await this.peerWantLists.receivedBlock(cid, options)
  }

  getWantlist (): WantListEntry[] {
    return [...this.wantList.wants.values()]
  }

  getPeerWantlist (peer: PeerId): WantListEntry[] | undefined {
    return this.peerWantLists.wantListForPeer(peer)
  }

  /**
   * Start the bitswap node
   */
  async start (): Promise<void> {
    this.status = 'starting'

    this.wantList.start()
    await this.network.start()
    this.status = 'started'
  }

  /**
   * Stop the bitswap node
   */
  async stop (): Promise<void> {
    this.status = 'stopping'

    this.wantList.stop()
    await this.network.stop()
    this.status = 'stopped'
  }
}
