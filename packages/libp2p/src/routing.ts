import { peerIdFromCID } from '@libp2p/peer-id'
import map from 'it-map'
import { withArrayBuffer } from 'uint8arrays/with-array-buffer'
import type { Peer, Provider, Router, RoutingOptions } from '@helia/interface'
import type { Libp2p, PeerInfo } from '@libp2p/interface'
import type { CID } from 'multiformats'

function peerInfoToPeer (info: PeerInfo): Peer {
  return {
    ...info,
    id: info.id.toCID(),
    router: 'libp2p-router'
  }
}

class Libp2pRouter implements Router {
  public readonly name = 'libp2p-router'
  private readonly libp2p: Libp2p

  constructor (libp2p: Libp2p) {
    this.libp2p = libp2p
  }

  async provide (cid: CID, options?: RoutingOptions): Promise<void> {
    await this.libp2p.contentRouting.provide(cid, options)
  }

  async cancelReprovide (key: CID, options?: RoutingOptions): Promise<void> {
    await this.libp2p.contentRouting.cancelReprovide(key, options)
  }

  async * findProviders (cid: CID, options?: RoutingOptions): AsyncIterable<Provider> {
    yield * map(this.libp2p.contentRouting.findProviders(cid, options), prov => ({
      ...peerInfoToPeer(prov)
    }))
  }

  async put (key: Uint8Array, value: Uint8Array, options?: RoutingOptions): Promise<void> {
    await this.libp2p.contentRouting.put(key, value, options)
  }

  async get (key: Uint8Array, options?: RoutingOptions): Promise<Uint8Array<ArrayBuffer>> {
    return withArrayBuffer(await this.libp2p.contentRouting.get(key, options))
  }

  async findPeer (peerId: CID, options?: RoutingOptions): Promise<Peer> {
    return peerInfoToPeer(await this.libp2p.peerRouting.findPeer(peerIdFromCID(peerId), options))
  }

  async * getClosestPeers (key: Uint8Array, options?: RoutingOptions): AsyncIterable<Peer> {
    yield * map(this.libp2p.peerRouting.getClosestPeers(key, options), peerInfoToPeer)
  }

  toString (): string {
    return 'Libp2pRouter()'
  }
}

export function libp2pRouting (libp2p: Libp2p): Router {
  return new Libp2pRouter(libp2p)
}
