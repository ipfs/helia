import type { Libp2p } from '@libp2p/interface-libp2p'
import type { IdResponse } from '@helia/interface'

interface IdComponents {
  libp2p: Libp2p
}

export function createId (components: IdComponents) {
  return async function id (): Promise<IdResponse> {
    return {
      peerId: components.libp2p.peerId,
      multiaddrs: components.libp2p.getMultiaddrs(),
      agentVersion: components.libp2p.identifyService.host.agentVersion,
      protocolVersion: components.libp2p.identifyService.host.protocolVersion,
      protocols: components.libp2p.getProtocols()
    }
  }
}
