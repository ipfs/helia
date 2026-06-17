import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { withBitswap } from '@helia/bitswap'
import { withLibp2p } from '@helia/libp2p'
import { identify } from '@libp2p/identify'
import { prefixLogger } from '@libp2p/logger'
import { createHelia } from 'helia'
import { createLibp2p } from 'libp2p'
import { getStores } from './stores.ts'
import { getTransports } from './transports.ts'
import type { HeliaWithLibp2p } from '@helia/libp2p'

export async function getHelia (): Promise<HeliaWithLibp2p> {
  const listen = `${process.env.HELIA_LISTEN ?? ''}`.split(',').filter(Boolean)
  const { datastore, blockstore } = await getStores()
  const logger = prefixLogger(`${process.env.HELIA_TYPE}`)

  const libp2p = await createLibp2p({
    logger,
    addresses: {
      listen
    },
    transports: getTransports(),
    connectionEncrypters: [
      noise()
    ],
    streamMuxers: [
      yamux()
    ],
    services: {
      identify: identify()
    },
    connectionGater: {
      denyDialMultiaddr: async () => false
    },
    datastore
  })

  return withBitswap(withLibp2p(createHelia({
    logger,
    blockstore,
    datastore
  }), libp2p)).start()
}
