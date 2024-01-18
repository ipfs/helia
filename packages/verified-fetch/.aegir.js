import getPort from 'aegir/get-port'
import { createServer } from 'ipfsd-ctl'
import * as kuboRpcClient from 'kubo-rpc-client'

/** @type {import('aegir').PartialOptions} */
export default {
  build: {
    bundlesizeMax: '10kB',
  },
  test: {
    files: './dist/test/**/*.spec.js',
    before: async (options) => {
      const ipfsdPort = await getPort()
      const ipfsdServer = await createServer({
        host: '127.0.0.1',
        port: ipfsdPort
      }, {
        ipfsBin: (await import('kubo')).default.path(),
        kuboRpcModule: kuboRpcClient,
        ipfsOptions: {
          // TODO: enable delegated routing
          // TODO: enable trustless-gateway
          config: {
            Addresses: {
              Swarm: [
                "/ip4/0.0.0.0/tcp/0",
                "/ip4/0.0.0.0/tcp/0/ws"
              ]
            }
          }
        }
      }).start()

      return {
        env: {
          IPFSD_SERVER: `http://127.0.0.1:${ipfsdPort}`,
        },
        ipfsdServer
      }
    },
    after: async (options, beforeResult) => {
      await beforeResult.ipfsdServer.stop()
    }
  }
}
