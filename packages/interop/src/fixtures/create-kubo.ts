/* eslint-disable @typescript-eslint/ban-ts-comment,@typescript-eslint/prefer-ts-expect-error */
import { createController, type Controller } from 'ipfsd-ctl'
import { path as kuboPath } from 'kubo'
import * as kuboRpcClient from 'kubo-rpc-client'

export async function createKuboNode (): Promise<Controller> {
  return createController({
    kuboRpcModule: kuboRpcClient,
    ipfsBin: kuboPath(),
    test: true,
    ipfsOptions: {
      config: {
        Addresses: {
          Swarm: [
            '/ip4/0.0.0.0/tcp/4001',
            '/ip4/0.0.0.0/tcp/4002/ws'
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
