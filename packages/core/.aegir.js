import { circuitRelayServer } from '@libp2p/circuit-relay-v2'
import { identify } from '@libp2p/identify'
import { WebSockets } from '@multiformats/mafmt'
import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import * as raw from 'multiformats/codecs/raw'
import { createLibp2p } from 'libp2p'
import { webSockets } from '@libp2p/websockets'
import { yamux } from '@chainsafe/libp2p-yamux'
import { noise } from '@chainsafe/libp2p-noise'

/** @type {import('aegir').PartialOptions} */
const options = {
  test: {
    before: async () => {
      // use dynamic import otherwise the source may not have been built yet
      const { createHelia } = await import('./dist/test/fixtures/create-helia.js')
      const { bitswap } = await import('@helia/block-brokers')

      const helia = await createHelia({
        blockBrokers: [
          bitswap()
        ],
        libp2p: await createLibp2p({
          addresses: {
            listen: [
              '/ip4/127.0.0.1/tcp/0/ws'
            ]
          },
          connectionManager: {
            inboundConnectionThreshold: Infinity,
            minConnections: 0
          },
          transports: [
            webSockets()
          ],
          streamMuxers: [
            yamux()
          ],
          connectionEncryption: [
            noise()
          ],
          services: {
            identify: identify(),
            relay: circuitRelayServer({
              reservations: {
                maxReservations: Infinity,
                applyDefaultLimit: false
              }
            })
          }
        })
      })

      const block = Uint8Array.from([0, 1, 2, 3])
      const mh = await sha256.digest(block)
      const cid = CID.createV1(raw.code, mh)
      await helia.blockstore.put(cid, block)

      return {
        env: {
          RELAY_SERVER: helia.libp2p.getMultiaddrs()
            .filter(ma => WebSockets.matches(ma))
            .map(ma => ma.toString())
            .pop(),
          BLOCK_CID: cid.toString()
        },
        helia
      }
    },
    after: async (_, beforeResult) => {
      if (beforeResult.helia != null) {
        await beforeResult.helia.stop()
      }
    }
  }
}

export default options
