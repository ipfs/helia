import { AbstractSession } from '@helia/utils'
import { isPeerId } from '@libp2p/interface'
import type { BitswapWantProgressEvents } from './index.js'
import type { Network } from './network.js'
import type { WantList } from './want-list.js'
import type { CreateSessionOptions } from '@helia/interface'
import type { ComponentLogger, Libp2p, PeerId } from '@libp2p/interface'
import type { Multiaddr } from '@multiformats/multiaddr'
import type { AbortOptions } from 'interface-store'
import type { CID } from 'multiformats/cid'

export interface BitswapSessionComponents {
  network: Network
  wantList: WantList
  logger: ComponentLogger
  libp2p: Libp2p
}

class BitswapSession extends AbstractSession<PeerId, BitswapWantProgressEvents> {
  private readonly wantList: WantList
  private readonly network: Network
  private readonly libp2p: Libp2p

  constructor (components: BitswapSessionComponents, init: CreateSessionOptions) {
    super(components, {
      ...init,
      name: 'helia:bitswap:session'
    })

    this.wantList = components.wantList
    this.network = components.network
    this.libp2p = components.libp2p
  }

  async queryProvider (cid: CID, provider: PeerId, options: AbortOptions): Promise<Uint8Array> {
    this.log('sending WANT-BLOCK for %c to %p', cid, provider)

    const result = await this.wantList.wantSessionBlock(cid, provider, options)

    this.log('%p %s %c', provider, result.has ? 'has' : 'does not have', cid)

    if (result.has && result.block != null) {
      return result.block
    }

    throw new Error('Provider did not have block')
  }

  async * findNewProviders (cid: CID, options: AbortOptions = {}): AsyncGenerator<PeerId> {
    for await (const provider of this.network.findProviders(cid, options)) {
      yield provider.id
    }
  }

  toEvictionKey (provider: PeerId): Uint8Array | string {
    return provider.toMultihash().bytes
  }

  equals (providerA: PeerId, providerB: PeerId): boolean {
    return providerA.equals(providerB)
  }

  async convertToProvider (provider: PeerId | Multiaddr | Multiaddr[], options?: AbortOptions): Promise<PeerId | undefined> {
    if (isPeerId(provider)) {
      return provider
    }

    const connection = await this.libp2p.dial(provider, options)

    return connection.remotePeer
  }
}

export function createBitswapSession (components: BitswapSessionComponents, init: CreateSessionOptions): BitswapSession {
  return new BitswapSession(components, init)
}
