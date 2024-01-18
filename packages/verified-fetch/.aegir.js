import getPort from 'aegir/get-port'
import { createServer, createController } from 'ipfsd-ctl'
import * as kuboRpcClient from 'kubo-rpc-client'
import drain from 'it-drain'
import { UnixFS } from 'ipfs-unixfs'

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

      const kuboNode = await createController({
        kuboRpcModule: kuboRpcClient,
        test: true,
        remote: true,
        endpoint: `http://127.0.0.1:${ipfsdPort}`,
        // env: {
        //   IPFS_PATH: './tmp/kubo'
        // },
        ipfsOptions: {
          config: {
            Addresses: {
              Swarm: [
                '/ip4/0.0.0.0/tcp/0',
                '/ip4/0.0.0.0/tcp/0/ws'
              ]
            }
          }
        },
        // TODO: enable delegated routing
        args: ['--enable-pubsub-experiment', '--enable-namesys-pubsub']
      })
      await kuboNode.start()

      // load fixtures

      const givenString = 'hello sgtpooki from verified-fetch test'
      const content = new UnixFS({ type: 'raw', data: (new TextEncoder()).encode(givenString) })
      const result = await kuboNode.api.add(content.marshal())
      console.log(result)
      await drain(await kuboNode.api.refs('/ipfs/QmdmQXB2mzChmMeKY47C43LxUdg1NDJ5MWcKMKxDu7RgQm/1 - Barrel - Part 1/1 - Barrel - Part 1 - alt.txt', {
        recursive: true
      }))
      await drain(await kuboNode.api.refs('/ipfs/QmQJ8fxavY54CUsxMSx9aE9Rdcmvhx8awJK2jzJp4iAqCr', {
        recursive: true
      }))

      return {
        env: {
          IPFSD_SERVER: `http://127.0.0.1:${ipfsdPort}`,
          KUBO_GATEWAY: `http://${kuboNode.api.gatewayHost}:${kuboNode.api.gatewayPort}`,
          KUBO_RPC_ENDPOINT: `http://${kuboNode.api.apiHost}:${kuboNode.api.apiPort}`
        },
        ipfsdServer,
        kuboNode
      }
    },
    after: async (options, beforeResult) => {
      await beforeResult.kuboNode.stop()
      await beforeResult.ipfsdServer.stop()
    }
  }
}
