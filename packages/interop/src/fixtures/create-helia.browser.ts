import { withBitswap } from '@helia/bitswap'
import { libp2pDefaults, withLibp2p } from '@helia/libp2p'
import { kadDHT, removePublicAddressesMapper } from '@libp2p/kad-dht'
import { webSockets } from '@libp2p/websockets'
import { sha3512 } from '@multiformats/sha3'
import { createHelia } from 'helia'
import type { DefaultLibp2pServices, HeliaWithLibp2p } from '@helia/libp2p'
import type { Libp2pOptions } from 'libp2p'

export async function createHeliaNode (): Promise<HeliaWithLibp2p<DefaultLibp2pServices>>
export async function createHeliaNode <Services extends Record<string, unknown>> (libp2pOptions: Libp2pOptions<Services>): Promise<HeliaWithLibp2p<Services & DefaultLibp2pServices>>
export async function createHeliaNode (libp2pOptions?: Libp2pOptions): Promise<HeliaWithLibp2p<DefaultLibp2pServices>> {
  const defaults = libp2pDefaults()

  // allow dialing insecure WebSockets
  defaults.transports?.pop()
  defaults.transports = [
    ...(defaults.transports ?? []),
    webSockets()
  ]

  // allow dialing loopback
  defaults.connectionGater = {
    denyDialMultiaddr: () => false
  }

  // use LAN DHT
  defaults.services = {
    ...(defaults.services ?? {}),
    ...(libp2pOptions?.services ?? {}),
    dht: kadDHT({
      protocol: '/ipfs/lan/kad/1.0.0',
      peerInfoMapper: removePublicAddressesMapper,
      clientMode: false
    })
  }

  // remove bootstrapper(s)
  defaults.peerDiscovery = []

  // remove services that are not used in tests
  // @ts-expect-error services.autoNAT is not optional
  delete defaults.services.autoNAT
  // @ts-expect-error services.dcutr is not optional
  delete defaults.services.dcutr
  // @ts-expect-error services.delegatedContentRouting is not optional
  delete defaults.services.delegatedContentRouting
  // @ts-expect-error services.delegatedPeerRouting is not optional
  delete defaults.services.delegatedPeerRouting

  return withBitswap(withLibp2p(createHelia({
    hashers: [
      sha3512
    ]
  }), defaults)).start()
}
