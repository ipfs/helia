import { withBitswap } from '@helia/bitswap'
import { libp2pDefaults, withLibp2pLight } from '@helia/libp2p'
import * as dagCbor from '@ipld/dag-cbor'
import * as dagJson from '@ipld/dag-json'
import { identify, identifyPush } from '@libp2p/identify'
import { kadDHT, removePublicAddressesMapper } from '@libp2p/kad-dht'
import { keychain } from '@libp2p/keychain'
import { ping } from '@libp2p/ping'
import { sha3512 } from '@multiformats/sha3'
import { createHeliaLight } from 'helia'
import * as json from 'multiformats/codecs/json'
import { sha512 } from 'multiformats/hashes/sha2'
import type { HeliaWithLibp2p } from '@helia/libp2p'
import type { Identify, IdentifyPush } from '@libp2p/identify'
import type { ServiceMap } from '@libp2p/interface'
import type { KadDHT } from '@libp2p/kad-dht'
import type { Keychain } from '@libp2p/keychain'
import type { Ping } from '@libp2p/ping'
import type { Libp2pOptions } from 'libp2p'

export interface Libp2pTestServices extends ServiceMap {
  dht: KadDHT,
  identify: Identify,
  identifyPush: IdentifyPush
  keychain: Keychain
  ping: Ping
}

export async function createHeliaNode (): Promise<HeliaWithLibp2p<Libp2pTestServices>>
export async function createHeliaNode <Services extends ServiceMap> (libp2pOptions: Libp2pOptions<Services>): Promise<HeliaWithLibp2p<Services & Libp2pTestServices>>
export async function createHeliaNode <Services extends ServiceMap> (libp2pOptions?: Libp2pOptions<Services>): Promise<HeliaWithLibp2p<Services & Libp2pTestServices>> {
  const defaults = libp2pDefaults()

  const config: Libp2pOptions<any> = {
    privateKey: libp2pOptions?.privateKey,
    dns: libp2pOptions?.dns,
    addresses: {
      listen: [
        '/ip4/0.0.0.0/tcp/0'
      ]
    },
    transports: defaults.transports,
    connectionEncrypters: defaults.connectionEncrypters,
    streamMuxers: defaults.streamMuxers,
    // remove bootstrapper(s)
    peerDiscovery: [],
    // allow dialing loopback
    connectionGater: {
      ...libp2pOptions?.connectionGater,
      denyDialMultiaddr: () => false
    },
    ...libp2pOptions,
    services: {
      // use LAN DHT
      dht: kadDHT({
        protocol: '/ipfs/lan/kad/1.0.0',
        peerInfoMapper: removePublicAddressesMapper,
        clientMode: false
      }),
      identify: identify(),
      identifyPush: identifyPush(),
      keychain: keychain(),
      ping: ping(),
      ...libp2pOptions?.services
    }
  }

  return withBitswap(withLibp2pLight(createHeliaLight({
    codecs: [
      dagCbor,
      dagJson,
      json
    ],
    hashers: [
      sha512,
      sha3512
    ]
  }), config)).start()
}
