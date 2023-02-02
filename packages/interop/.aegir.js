import getPort from 'aegir/get-port'
import { createServer } from 'ipfsd-ctl'
import * as kuboRpcClient from 'kubo-rpc-client'

/** @type {import('aegir').PartialOptions} */
export default {
  test: {
    before: async (options) => {
      if (options.runner !== 'node') {
        const ipfsdPort = await getPort()
        const ipfsdServer = await createServer({
          host: '127.0.0.1',
          port: ipfsdPort
        }, {
          ipfsBin: (await import('go-ipfs')).default.path(),
          kuboRpcModule: kuboRpcClient,
          ipfsOptions: {
            config: {
              Addresses: {
                Swarm: [
                  "/ip4/0.0.0.0/tcp/4001",
                  "/ip4/0.0.0.0/tcp/4002/ws"
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
