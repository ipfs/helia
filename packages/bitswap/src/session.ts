import { AbstractSession } from '@helia/utils'
import type { BitswapWantProgressEvents } from './index.js'
import type { Network } from './network.js'
import type { WantList } from './want-list.js'
import type { CreateSessionOptions } from '@helia/interface'
import type { ComponentLogger, PeerId } from '@libp2p/interface'
import type { AbortOptions } from 'interface-store'
import type { CID } from 'multiformats/cid'

export interface BitswapSessionComponents {
  network: Network
  wantList: WantList
  logger: ComponentLogger
}

class BitswapSession extends AbstractSession<PeerId, BitswapWantProgressEvents> {
  private readonly wantList: WantList
  private readonly network: Network

  constructor (components: BitswapSessionComponents, init: CreateSessionOptions) {
    super(components, {
      ...init,
      name: 'helia:bitswap:session'
    })

    this.wantList = components.wantList
    this.network = components.network
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
    return provider.toBytes()
  }

  equals (providerA: PeerId, providerB: PeerId): boolean {
    return providerA.equals(providerB)
  }
}

export function createBitswapSession (components: BitswapSessionComponents, init: CreateSessionOptions): BitswapSession {
  return new BitswapSession(components, init)
}
