import type { Libp2p } from '@libp2p/interface-libp2p'
import type { InfoResponse } from '@helia/interface'

interface InfoComponents {
  libp2p: Libp2p
}

export function createInfo (components: InfoComponents) {
  return async function info (): Promise<InfoResponse> {
    return {
      peerId: components.libp2p.peerId,
      multiaddrs: components.libp2p.getMultiaddrs(),
      agentVersion: components.libp2p.identifyService.host.agentVersion,
      protocolVersion: components.libp2p.identifyService.host.protocolVersion,
      protocols: components.libp2p.getProtocols(),
      status: components.libp2p.isStarted() ? 'running' : 'stopped'
    }
  }
}
