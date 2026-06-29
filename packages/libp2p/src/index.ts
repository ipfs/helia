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
import { isLibp2p } from 'libp2p'
import { libp2pRouting } from './routing.ts'
import { createLibp2p } from './utils/libp2p.ts'
import type { DefaultLibp2pServices } from './utils/libp2p-defaults.ts'
import type { CreateLibp2pOptions } from './utils/libp2p.ts'
import type { Helia, HeliaMixin } from '@helia/interface'
import type { Libp2p, ServiceMap } from '@libp2p/interface'

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
  let libp2p: any

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
