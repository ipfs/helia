import type { Helia } from '@helia/interface'
import { createInfo } from './commands/info.js'
import type { Libp2p } from '@libp2p/interface-libp2p'
import type { Multiaddr } from '@multiformats/multiaddr'
import { createBlockstoreDelete } from './commands/blockstore/delete.js'
import { createBlockstoreGet } from './commands/blockstore/get.js'
import { createBlockstoreHas } from './commands/blockstore/has.js'
import { createBlockstorePut } from './commands/blockstore/put.js'
import { createAuthorizationGet } from './commands/authorization/get.js'
import { createBlockstoreDeleteMany } from './commands/blockstore/delete-many.js'
import { createBlockstoreGetMany } from './commands/blockstore/get-many.js'
import { createBlockstorePutMany } from './commands/blockstore/put-many.js'
import { createBlockstoreClose } from './commands/blockstore/close.js'
import { createBlockstoreOpen } from './commands/blockstore/open.js'
import { createBlockstoreBatch } from './commands/blockstore/batch.js'
import { createBlockstoreQueryKeys } from './commands/blockstore/query-keys.js'
import { createBlockstoreQuery } from './commands/blockstore/query.js'

export interface HeliaRpcClientConfig {
  multiaddr: Multiaddr
  libp2p: Libp2p
  user: string
}

export interface HeliaRpcMethodConfig {
  multiaddr: Multiaddr
  libp2p: Libp2p
  authorization?: string
}

export async function createHeliaRpcClient (config: HeliaRpcClientConfig): Promise<Helia> {
  await config.libp2p.dial(config.multiaddr)

  const getAuthorization = createAuthorizationGet(config)
  const authorization = await getAuthorization(config.user)
  const methodConfig = {
    ...config,
    authorization
  }

  return {
    info: createInfo(methodConfig),
    blockstore: {
      batch: createBlockstoreBatch(methodConfig),
      close: createBlockstoreClose(methodConfig),
      deleteMany: createBlockstoreDeleteMany(methodConfig),
      delete: createBlockstoreDelete(methodConfig),
      getMany: createBlockstoreGetMany(methodConfig),
      get: createBlockstoreGet(methodConfig),
      has: createBlockstoreHas(methodConfig),
      open: createBlockstoreOpen(methodConfig),
      putMany: createBlockstorePutMany(methodConfig),
      put: createBlockstorePut(methodConfig),
      queryKeys: createBlockstoreQueryKeys(methodConfig),
      query: createBlockstoreQuery(methodConfig)
    },
    // @ts-expect-error incomplete implementation
    datastore: {

    },
    // @ts-expect-error incomplete implementation
    libp2p: {

    },
    async stop () {
      throw new Error('Not implemented')
    }
  }
}
