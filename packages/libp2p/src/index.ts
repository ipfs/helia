/**
 * @packageDocumentation
 *
 * Adds libp2p functionality to Helia
 *
 * @example
 *
 * ```ts
 * import { createHelia } from 'helia'
 * import { withLibp2p } from '@helia/libp2p'
 *
 * const node = await withLibp2p(createHelia()).start()
 *
 * console.info(node.libp2p.peerId) // 12D3Koo...
 * ```
 */

import { NotStartedError } from '@libp2p/interface'
import { peerIdFromCID } from '@libp2p/peer-id'
import forEach from 'it-foreach'
import { isLibp2p } from 'libp2p'
import { libp2pRouting } from './routing.ts'
import { createLibp2p } from './utils/libp2p.ts'
import type { DefaultLibp2pServices } from './utils/libp2p-defaults.ts'
import type { CreateLibp2pOptions } from './utils/libp2p.ts'
import type { Helia, HeliaMixin, Peer } from '@helia/interface'
import type { Libp2p, PeerInfo, ServiceMap } from '@libp2p/interface'
import type { Multiaddr } from '@multiformats/multiaddr'
import type { CID } from 'multiformats'

export { libp2pDefaults } from './utils/libp2p-defaults.ts'
export type { DefaultLibp2pServices } from './utils/libp2p-defaults.ts'
export type { CreateLibp2pOptions }

export interface HeliaWithLibp2p<M extends ServiceMap = DefaultLibp2pServices> extends Helia {
  /**
   * Libp2p provides a peer identity and a networking layer
   */
  libp2p: Libp2p<M>
}

async function getLibp2p <H extends Helia, M extends ServiceMap = ServiceMap> (helia: H, opts?: CreateLibp2pOptions<M>): Promise<Libp2p<M>> {
  if (isLibp2p(opts)) {
    return opts as any
  }

  return createLibp2p(helia, {
    ...opts,
    dns: helia.dns,
    logger: helia.logger,
    datastore: helia.datastore
  })
}

/**
 * Return a Helia node augmented with a libp2p instance
 */
export function withLibp2p <H extends Helia, M extends ServiceMap = ServiceMap, L extends Libp2p = Libp2p<M>> (helia: H, opts: L): H & HeliaWithLibp2p<M>
export function withLibp2p <H extends Helia, M extends ServiceMap = ServiceMap> (helia: H, opts?: CreateLibp2pOptions<M>): H & HeliaWithLibp2p<M>
export function withLibp2p <H extends Helia, M extends ServiceMap = ServiceMap> (helia: H, opts?: CreateLibp2pOptions<M>): H & HeliaWithLibp2p {
  let libp2p: Libp2p

  // add a getter that informs the user they need to start Helia
  Object.defineProperty(helia, 'libp2p', {
    configurable: true,
    enumerable: true,
    get () {
      if (libp2p != null) {
        return libp2p
      }

      throw new NotStartedError()
    }
  })

  const mixin: HeliaMixin<H & { libp2p?: Libp2p<M> }, H & { libp2p?: Libp2p<M> }> = {
    name: 'libp2p',
    start: async (helia) => {
      if (libp2p == null) {
        libp2p = await getLibp2p(helia, opts)

        // override peer discovery methods to ensure we persist peer data in the
        // peer store, otherwise we can't dial by peer id without extra lookups
        const findProviders = helia.routing.findProviders.bind(helia.routing)
        helia.routing.findProviders = async function * (cid, options): AsyncIterable<Peer> {
          yield * forEach(findProviders.call(helia.routing, cid, options), async (peer) => {
            if (peer.routing !== 'libp2p-router') {
              // only need to do this for peers not found via the libp2p router
              const info = toPeerInfo(peer)
              await libp2p.peerStore.merge(info.id, info)
            }
          })
        }

        const findPeer = helia.routing.findPeer.bind(helia.routing)
        helia.routing.findPeer = async function (cid, options): Promise<Peer> {
          const peer = await findPeer(cid, options)

          if (peer.routing !== 'libp2p-router') {
            // only need to do this for peers not found via the libp2p router
            const info = toPeerInfo(peer)
            await libp2p.peerStore.merge(info.id, info)
          }

          return peer
        }

        // override peer discovery methods to ensure we persist peer data in the
        // peer store, otherwise we can't dial by peer id without extra lookups
        const getClosestPeers = helia.routing.getClosestPeers.bind(helia.routing)
        helia.routing.getClosestPeers = async function * (cid, options): AsyncIterable<Peer> {
          yield * forEach(getClosestPeers.call(helia.routing, cid, options), async (peer) => {
            if (peer.routing !== 'libp2p-router') {
              // only need to do this for peers not found via the libp2p router
              const info = toPeerInfo(peer)
              await libp2p.peerStore.merge(info.id, info)
            }
          })
        }
      }

      try {
        if (!helia.hasRouter('libp2p-router')) {
          helia.addRouter(libp2pRouting(libp2p))
        }

        if (isLibp2p(helia.libp2p)) {
          // already configured libp2p
          await helia.libp2p.start()
        }
      } catch (err: any) {
        if (err.name !== 'NotStartedError') {
          throw err
        }
      }
    },

    stop: async () => {
      await libp2p?.stop()
    }
  }

  helia.addMixin(mixin)

  // @ts-expect-error libp2p property is missing, even though we just defined it
  return helia
}

function toPeerInfo (peer: { id: CID, multiaddrs: Multiaddr[] }): PeerInfo {
  return {
    id: peerIdFromCID(peer.id),
    multiaddrs: peer.multiaddrs
  }
}
