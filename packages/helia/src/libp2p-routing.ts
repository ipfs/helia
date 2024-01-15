import type { Provider, Routing, RoutingOptions } from '@helia/interface'
import type { Libp2p, PeerId, PeerInfo } from '@libp2p/interface'
import type { CID } from 'multiformats'

export class Libp2pRouting implements Routing {
  private readonly libp2p: Libp2p

  constructor (libp2p: Libp2p) {
    this.libp2p = libp2p
  }

  async provide (cid: CID, options?: RoutingOptions): Promise<void> {
    await this.libp2p.contentRouting.provide(cid, options)
  }

  async * findProviders (cid: CID, options?: RoutingOptions): AsyncIterable<Provider> {
    yield * this.libp2p.contentRouting.findProviders(cid, options)
  }

  async put (key: Uint8Array, value: Uint8Array, options?: RoutingOptions): Promise<void> {
    await this.libp2p.contentRouting.put(key, value, options)
  }

  async get (key: Uint8Array, options?: RoutingOptions): Promise<Uint8Array> {
    return this.libp2p.contentRouting.get(key, options)
  }

  async findPeer (peerId: PeerId, options?: RoutingOptions): Promise<PeerInfo> {
    return this.libp2p.peerRouting.findPeer(peerId, options)
  }

  async * getClosestPeers (key: Uint8Array, options?: RoutingOptions): AsyncIterable<PeerInfo> {
    yield * this.libp2p.peerRouting.getClosestPeers(key, options)
  }
}
