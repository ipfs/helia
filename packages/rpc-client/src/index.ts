import type { Helia } from '@helia/interface'
import { createId } from './commands/id.js'
import type { Libp2p } from '@libp2p/interface-libp2p'
import type { Multiaddr } from '@multiformats/multiaddr'
import { createBlockstoreDelete } from './commands/blockstore/delete.js'
import { createBlockstoreGet } from './commands/blockstore/get.js'
import { createBlockstoreHas } from './commands/blockstore/has.js'
import { createBlockstorePut } from './commands/blockstore/put.js'
import { createAuthorizationGet } from './commands/authorization/get.js'

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
    id: createId(methodConfig),
    // @ts-expect-error incomplete implementation
    blockstore: {
      delete: createBlockstoreDelete(methodConfig),
      get: createBlockstoreGet(methodConfig),
      has: createBlockstoreHas(methodConfig),
      put: createBlockstorePut(methodConfig)
    }
  }
}
