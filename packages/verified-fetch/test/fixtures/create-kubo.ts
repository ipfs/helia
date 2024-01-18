import { type Controller, createController } from 'ipfsd-ctl'
import { path as kuboPath } from 'kubo'
import * as kuboRpcClient from 'kubo-rpc-client'

export async function createKuboNode (): Promise<Controller> {
  return createController({
    kuboRpcModule: kuboRpcClient,
    ipfsBin: kuboPath(),
    test: true,
    endpoint: process.env.IPFSD_SERVER,
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
    args: ['--enable-pubsub-experiment', '--enable-namesys-pubsub']
  })
}
