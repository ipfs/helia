import getPort from 'aegir/get-port'
import { createServer } from 'ipfsd-ctl'
import * as kuboRpcClient from 'kubo-rpc-client'

/** @type {import('aegir').PartialOptions} */
export default {
  test: {
    files: './dist/src/*.spec.js',
    before: async (options) => {
      if (options.runner !== 'node') {
        const ipfsdPort = await getPort()
        const ipfsdServer = await createServer({
          host: '127.0.0.1',
          port: ipfsdPort
        }, {
          ipfsBin: (await import('kubo')).default.path(),
          kuboRpcModule: kuboRpcClient,
          ipfsOptions: {
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
            IPFSD_SERVER: `http://127.0.0.1:${ipfsdPort}`
          },
          ipfsdServer
        }
      }

      return {}
    },
    after: async (options, beforeResult) => {
      if (options.runner !== 'node') {
        await beforeResult.ipfsdServer.stop()
      }
    }
  }
}
