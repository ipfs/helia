import { bitswap } from '@helia/block-brokers'
import { ipnsValidator, ipnsSelector } from '@helia/ipns'
import { kadDHT, removePublicAddressesMapper } from '@libp2p/kad-dht'
import { webSockets } from '@libp2p/websockets'
import { all } from '@libp2p/websockets/filters'
import { sha3512 } from '@multiformats/sha3'
import { createHelia, libp2pDefaults } from 'helia'
import type { Helia } from '@helia/interface'
import type { Libp2p } from '@libp2p/interface'
import type { DefaultLibp2pServices } from 'helia'

export async function createHeliaNode (): Promise<Helia<Libp2p<DefaultLibp2pServices>>> {
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

  // remove bootstrappers
  defaults.peerDiscovery = []

  // remove services that are not used in tests
  delete defaults.services.autoNAT
  delete defaults.services.dcutr
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
