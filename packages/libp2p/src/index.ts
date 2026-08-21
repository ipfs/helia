/**
 * @packageDocumentation
 *
 * Adds libp2p functionality to Helia
 *
 * @example With default config
 *
 * ```ts
 * import { createHelia } from 'helia'
 * import { withLibp2p } from '@helia/libp2p'
 *
 * const node = await withLibp2p(createHelia()).start()
 *
 * console.info(node.libp2p.peerId) // 12D3Koo...
 * ```
 *
 * @example Custom config
 *
 * By default `withLibp2p` configures a libp2p node for the current environment.
 *
 * Any options passed will be merged with the default config.
 *
 * For full control over your node (and the bundle size), use `withLibp2pLight`:
 *
 * ```ts
 * import { createHelia } from 'helia'
 * import { withLibp2pLight } from '@helia/libp2p'
 *
 * const node = await withLibp2pLight(createHelia(), {
 *   //... libp2p config here
 * }).start()
 *
 * console.info(node.libp2p.peerId) // 12D3Koo...
 * ```
 */

import { loadOrCreateSelfKey } from '@libp2p/config'
import { NotStartedError } from '@libp2p/interface'
import { peerIdFromCID } from '@libp2p/peer-id'
import forEach from 'it-foreach'
import { createLibp2p, isLibp2p } from 'libp2p'
import { userAgent } from 'libp2p/user-agent'
import { libp2pRouting } from './routing.ts'
import { libp2pDefaults } from './utils/libp2p-defaults.ts'
import type { DefaultLibp2pServices } from './utils/libp2p-defaults.ts'
import type { Helia, HeliaMixin, Peer, Provider } from '@helia/interface'
import type { Libp2p, PeerInfo, ServiceMap } from '@libp2p/interface'
import type { KeychainInit } from '@libp2p/keychain'
import type { Multiaddr } from '@multiformats/multiaddr'
import type { Libp2pOptions } from 'libp2p'
import type { CID } from 'multiformats'

export { libp2pDefaults } from './utils/libp2p-defaults.ts'
export type { DefaultLibp2pServices } from './utils/libp2p-defaults.ts'

export interface CreateLibp2pOptions<T extends ServiceMap> extends Libp2pOptions<T> {
  keychain?: KeychainInit
}

export interface HeliaWithLibp2p<M extends ServiceMap = DefaultLibp2pServices> extends Helia {
  /**
   * Libp2p provides a peer identity and a networking layer
   */
  libp2p: Libp2p<M>
}

/**
 * Return a Helia node augmented with a libp2p instance
 */
export function withLibp2p <H extends Helia> (helia: H): H & HeliaWithLibp2p<DefaultLibp2pServices>
export function withLibp2p <H extends Helia, M extends ServiceMap> (helia: H, opts: CreateLibp2pOptions<M>): H & HeliaWithLibp2p<DefaultLibp2pServices & M>
export function withLibp2p <H extends Helia> (helia: H, opts?: any): H & HeliaWithLibp2p<DefaultLibp2pServices> {
  return withLibp2pLight(helia, libp2pDefaults(opts))
}

/**
 * Return a Helia node augmented with a libp2p instance. The passed
 * configuration is passed to `createLibp2p` without adding any default config.
 *
 * Use this if you do not wish to have any extra config added.
 */
export function withLibp2pLight <H extends Helia, M extends ServiceMap = ServiceMap> (helia: H, opts: CreateLibp2pOptions<M>): H & HeliaWithLibp2p<M> {
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
        // if no peer id was passed, try to load it from the keychain
        if (opts.privateKey == null) {
          opts.privateKey = await loadOrCreateSelfKey(helia.datastore, opts.keychain)
        }

        // copy options from Helia node
        opts.nodeInfo ??= {}
        opts.nodeInfo.name ??= helia.info.name
        opts.nodeInfo.version ??= helia.info.version
        opts.nodeInfo.userAgent ??= `${helia.info.name}/${helia.info.version} ${userAgent()}`

        opts.datastore ??= helia.datastore

        libp2p = await createLibp2p(opts)

        // override peer discovery methods to ensure we persist peer data in the
        // peer store, otherwise we can't dial by peer id without extra lookups
        const findProviders = helia.routing.findProviders.bind(helia.routing)
        helia.routing.findProviders = async function * (cid, options): AsyncIterable<Provider> {
          yield * forEach(findProviders.call(helia.routing, cid, options), async (peer) => {
            if (peer.router !== 'libp2p-router') {
              // only need to do this for peers not found via the libp2p router
              const info = toPeerInfo(peer)
              await libp2p.peerStore.merge(info.id, info)
            }
          })
        }

        const findPeer = helia.routing.findPeer.bind(helia.routing)
        helia.routing.findPeer = async function (cid, options): Promise<Peer> {
          const peer = await findPeer(cid, options)

          if (peer.router !== 'libp2p-router') {
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
            if (peer.router !== 'libp2p-router') {
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
