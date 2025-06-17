import { createNode } from 'ipfsd-ctl'
import { path as kuboPath } from 'kubo'
import { create as kuboRpcClient } from 'kubo-rpc-client'
import type { KuboNode } from 'ipfsd-ctl'

export async function createKuboNode (): Promise<KuboNode> {
  return createNode({
    type: 'kubo',
    rpc: kuboRpcClient,
    bin: kuboPath(),
    test: true,
    init: {
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
    start: {
      args: ['--enable-pubsub-experiment', '--enable-namesys-pubsub']
    }
  })
}
