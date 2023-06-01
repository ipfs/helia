import { circuitRelayServer } from 'libp2p/circuit-relay'
import { identifyService } from 'libp2p/identify'
import { WebSockets } from '@multiformats/mafmt'

/** @type {import('aegir').PartialOptions} */
const options = {
  test: {
    before: async () => {
      // use dynamic import otherwise the source may not have been built yet
      const { createHelia } = await import('./dist/src/index.js')

      const helia = await createHelia({
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

      return {
        env: {
          RELAY_SERVER: helia.libp2p.getMultiaddrs()
            .filter(ma => WebSockets.matches(ma))
            .map(ma => ma.toString())
            .pop()
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
