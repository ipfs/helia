import { circuitRelayServer } from 'libp2p/circuit-relay'
import { identifyService } from 'libp2p/identify'
import { WebSockets } from '@multiformats/mafmt'
import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import * as raw from 'multiformats/codecs/raw'

/** @type {import('aegir').PartialOptions} */
const options = {
  test: {
    before: async () => {
      // use dynamic import otherwise the source may not have been built yet
      const { createHelia } = await import('./dist/src/index.js')
      const { bitswap } = await import('./dist/src/block-brokers/index.js')

      const helia = await createHelia({
        blockBrokers: [
          bitswap()
        ],
        libp2p: {
          addresses: {
            listen: [
              `/ip4/127.0.0.1/tcp/0/ws`
            ]
          },
          services: {
            identify: identifyService(),
            relay: circuitRelayServer({
              reservations: {
                maxReservations: Infinity,
                applyDefaultLimit: false
              }
            })
          }
        }
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
