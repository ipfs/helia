import { type Controller, createController } from 'ipfsd-ctl'
import * as kuboRpcClient from 'kubo-rpc-client'

export async function createKuboNode (): Promise<Controller> {
  return createController({
    kuboRpcModule: kuboRpcClient,
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
    }
  })
}
