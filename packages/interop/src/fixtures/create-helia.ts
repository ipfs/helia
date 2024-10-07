import { bitswap } from '@helia/block-brokers'
import { ipnsValidator, ipnsSelector } from '@helia/ipns'
import { kadDHT, removePublicAddressesMapper } from '@libp2p/kad-dht'
import { sha3512 } from '@multiformats/sha3'
import { createHelia, libp2pDefaults } from 'helia'
import type { Libp2p } from '@libp2p/interface'
import type { DefaultLibp2pServices, HeliaLibp2p } from 'helia'
import type { Libp2pOptions } from 'libp2p'

export async function createHeliaNode (): Promise<HeliaLibp2p<Libp2p<DefaultLibp2pServices>>>
export async function createHeliaNode <Services extends Record<string, unknown>> (libp2pOptions: Libp2pOptions<Services>): Promise<HeliaLibp2p<Libp2p<Services & DefaultLibp2pServices>>>
export async function createHeliaNode (libp2pOptions?: Libp2pOptions): Promise<HeliaLibp2p<Libp2p<DefaultLibp2pServices>>> {
  const defaults = libp2pDefaults()
  defaults.addresses = {
    listen: [
      '/ip4/0.0.0.0/tcp/0'
    ]
  }
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
      protocol: '/ipfs/lan/kad/1.0.0',
      peerInfoMapper: removePublicAddressesMapper,
      clientMode: false
    })
  }

  // remove bootstrappers, mdns, etc
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
