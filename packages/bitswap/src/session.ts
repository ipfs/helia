import { AbstractSession } from '@helia/utils'
import { isPeerId } from '@libp2p/interface'
import { CustomProgressEvent } from 'progress-events'
import type { BitswapProvider, BitswapWantProgressEvents } from './index.js'
import type { Network } from './network.js'
import type { WantList } from './want-list.js'
import type { BlockRetrievalOptions, CreateSessionOptions } from '@helia/interface'
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

interface ProviderPeer {
  peerId: PeerId
  routing: string
}

class BitswapSession extends AbstractSession<ProviderPeer, BitswapWantProgressEvents> {
  public readonly name = 'bitswap-session'
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

  async queryProvider (cid: CID, provider: ProviderPeer, options: AbortOptions): Promise<Uint8Array> {
    this.log('sending WANT-BLOCK for %c to %p', cid, provider)

    const result = await this.wantList.wantSessionBlock(cid, provider.peerId, options)

    this.log('%p %s %c', provider, result.has ? 'has' : 'does not have', cid)

    if (result.has && result.block != null) {
      return result.block
    }

    throw new Error('Provider did not have block')
  }

  async * findNewProviders (cid: CID, options: AbortOptions = {}): AsyncGenerator<ProviderPeer> {
    for await (const provider of this.network.findProviders(cid, options)) {
      yield {
        peerId: provider.id,
        routing: provider.routing
      }
    }
  }

  toFilterKey (provider: ProviderPeer): Uint8Array | string {
    return provider.peerId.toMultihash().bytes
  }

  equals (providerA: ProviderPeer, providerB: ProviderPeer): boolean {
    return providerA.peerId.equals(providerB.peerId)
  }

  async convertToProvider (provider: PeerId | Multiaddr | Multiaddr[], routing: string, options?: AbortOptions): Promise<ProviderPeer | undefined> {
    if (isPeerId(provider)) {
      return {
        peerId: provider,
        routing
      }
    }

    if (await this.libp2p.isDialable(provider) === false) {
      return
    }

    try {
      const connection = await this.libp2p.dial(provider, options)

      return {
        peerId: connection.remotePeer,
        routing
      }
    } catch {}
  }

  emitFoundProviderProgressEvent (cid: CID, provider: ProviderPeer, options: BlockRetrievalOptions<BitswapWantProgressEvents>): void {
    options?.onProgress?.(new CustomProgressEvent<BitswapProvider>('bitswap:found-provider', {
      type: 'bitswap',
      cid,
      provider: {
        id: provider.peerId,
        multiaddrs: [],
        routing: provider.routing
      },
      routing: provider.routing
    }))
  }
}

export function createBitswapSession (components: BitswapSessionComponents, init: CreateSessionOptions): BitswapSession {
  return new BitswapSession(components, init)
}
