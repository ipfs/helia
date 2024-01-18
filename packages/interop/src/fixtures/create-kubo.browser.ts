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
          ],
          Gateway: '/ip4/127.0.0.1/tcp/8180'
        },
        Gateway: {
          NoFetch: true,
          ExposeRoutingAPI: true,
          HTTPHeaders: {
            'Access-Control-Allow-Origin': ['*'],
            'Access-Control-Allow-Methods': ['GET', 'POST', 'PUT', 'OPTIONS']
          }
        }
      }
    },
    args: ['--enable-pubsub-experiment', '--enable-namesys-pubsub']
  })
}
