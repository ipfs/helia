import { bitswap } from '@helia/block-brokers'
import { ipnsValidator, ipnsSelector } from '@helia/ipns'
import { kadDHT, removePublicAddressesMapper } from '@libp2p/kad-dht'
import { webSockets } from '@libp2p/websockets'
import { all } from '@libp2p/websockets/filters'
import { sha3512 } from '@multiformats/sha3'
import { createHelia, libp2pDefaults } from 'helia'
import type { Libp2p } from '@libp2p/interface'
import type { DefaultLibp2pServices, Helia } from 'helia'
import type { Libp2pOptions } from 'libp2p'

export async function createHeliaNode (): Promise<Helia<Libp2p<DefaultLibp2pServices>>>
export async function createHeliaNode <Services extends Record<string, unknown>> (libp2pOptions: Libp2pOptions<Services>): Promise<Helia<Libp2p<Services & DefaultLibp2pServices>>>
export async function createHeliaNode (libp2pOptions?: Libp2pOptions): Promise<Helia<Libp2p<DefaultLibp2pServices>>> {
  const defaults = libp2pDefaults()

  // allow dialing insecure WebSockets
  defaults.transports?.pop()
  defaults.transports = [
    ...(defaults.transports ?? []),
    webSockets({
      filter: all
    })
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
      validators: {
        ipns: ipnsValidator
      },
      selectors: {
        ipns: ipnsSelector
      },
      // skips waiting for the initial self-query to find peers
      allowQueryWithZeroPeers: true,

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
  // @ts-expect-error services.delegatedRouting is not optional
  delete defaults.services.delegatedRouting

  return createHelia<Libp2p<DefaultLibp2pServices>>({
    blockBrokers: [
      bitswap()
    ],
    libp2p: defaults,
    hashers: [
      sha3512
    ]
  })
}
