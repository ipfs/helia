import type { Helia } from '@helia/interface'
import { createId } from './commands/id.js'
import type { Libp2p } from '@libp2p/interface-libp2p'
import type { Multiaddr } from '@multiformats/multiaddr'

export interface HeliaRpcClientConfig {
  multiaddr: Multiaddr
  libp2p: Libp2p
  authorization: string
}

export async function createHeliaRpcClient (config: HeliaRpcClientConfig): Promise<Helia> {
  await config.libp2p.dial(config.multiaddr)

  // @ts-expect-error incomplete implementation
  return {
    id: createId(config)
  }
}
