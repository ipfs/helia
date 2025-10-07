/**
 * @packageDocumentation
 *
 * Exports a `createHelia` function that returns an object that implements the {@link Helia} API.
 *
 * Pass it to other modules like {@link https://www.npmjs.com/package/@helia/unixfs | @helia/unixfs} to make files available on the distributed web.
 *
 * @example
 *
 * ```typescript
 * import { createHelia } from 'helia'
 * import { unixfs } from '@helia/unixfs'
 * import { CID } from 'multiformats/cid'
 *
 * const helia = await createHelia()
 *
 * const fs = unixfs(helia)
 * fs.cat(CID.parse('bafyFoo'))
 * ```
 */

import { bitswap, trustlessGateway } from '@helia/block-brokers'
import { httpGatewayRouting, libp2pRouting } from '@helia/routers'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { isLibp2p } from 'libp2p'
import { createLibp2p } from '../utils/libp2p.js'
import type { DefaultLibp2pServices } from '../utils/libp2p-defaults.js'
import type { HeliaInit } from '@helia/utils'
import type { Libp2p } from '@libp2p/interface'

/**
 * Create and return the default options used to create a Helia node
 */
export async function heliaDefaults <T extends Libp2p> (init: Partial<HeliaInit<T>> = {}): Promise<Omit<HeliaInit<T>, 'libp2p'> & { libp2p: T }> {
  const datastore = init.datastore ?? new MemoryDatastore()
  const blockstore = init.blockstore ?? new MemoryBlockstore()

  let libp2p: any

  if (isLibp2p(init.libp2p)) {
    libp2p = init.libp2p as any
  } else {
    libp2p = await createLibp2p<DefaultLibp2pServices>({
      ...init,
      libp2p: {
        dns: init.dns,
        ...init.libp2p,

        // ignore the libp2p start parameter as it should be on the main init
        // object instead
        start: undefined
      },
      datastore
    })
  }

  return {
    ...init,
    libp2p,
    datastore,
    blockstore,
    blockBrokers: init.blockBrokers ?? [
      trustlessGateway(),
      bitswap()
    ],
    routers: init.routers ?? [
      libp2pRouting(libp2p),
      httpGatewayRouting()
    ],
    metrics: libp2p.metrics
  }
}
