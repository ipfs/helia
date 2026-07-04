import { AbstractSession, isCID } from '@helia/utils'
import { peerIdFromCID } from '@libp2p/peer-id'
import { CID } from 'multiformats/cid'
import { CustomProgressEvent } from 'progress-events'
import type { BitswapProvider, BitswapWantProgressEvents } from './index.ts'
import type { Network } from './network.ts'
import type { WantList } from './want-list.ts'
import type { BlockRetrievalOptions, CreateSessionOptions } from '@helia/interface'
import type { ComponentLogger, Libp2p, AbortOptions } from '@libp2p/interface'
import type { Multiaddr } from '@multiformats/multiaddr'

export interface BitswapSessionComponents {
  network: Network
  wantList: WantList
  logger: ComponentLogger
  libp2p: Libp2p
}

interface ProviderPeer {
  peerId: CID
  router: string
  toString(): string
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
    const peerId = peerIdFromCID(provider.peerId)

    this.log('sending WANT-BLOCK for %c to %p', cid, peerId)

    const result = await this.wantList.wantSessionBlock(cid, peerId, options)

    this.log('%p %s %c', provider, result.has ? 'has' : 'does not have', cid)

    if (result.has) {
      if (result.block != null) {
        return result.block
      }

      throw new Error('Provider has block but did not send it to us')
    }

    throw new Error('Provider did not have block')
  }

  async * findNewProviders (cid: CID, options: AbortOptions = {}): AsyncGenerator<ProviderPeer> {
    for await (const provider of this.network.findProviders(cid, options)) {
      yield {
        peerId: provider.id,
        router: provider.router,
        toString: () => `Bitswap(${provider.id})`
      }
    }
  }

  toFilterKey (provider: ProviderPeer): Uint8Array | string {
    return provider.peerId.multihash.bytes
  }

  equals (providerA: ProviderPeer, providerB: ProviderPeer): boolean {
    return providerA.peerId.equals(providerB.peerId)
  }

  async convertToProvider (provider: CID | Multiaddr | Multiaddr[], router: string, options?: AbortOptions): Promise<ProviderPeer | undefined> {
    if (isCID(provider)) {
      return {
        peerId: provider,
        router,
        toString: () => `Bitswap(${provider})`
      }
    }

    if (await this.libp2p.isDialable(provider) === false) {
      return
    }

    try {
      const connection = await this.libp2p.dial(provider, options)

      return {
        peerId: connection.remotePeer.toCID(),
        router,
        toString: () => `Bitswap(${connection.remotePeer})`
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
        router: provider.router
      },
      router: provider.router
    }))
  }
}

export function createBitswapSession (components: BitswapSessionComponents, init: CreateSessionOptions): BitswapSession {
  return new BitswapSession(components, init)
}
