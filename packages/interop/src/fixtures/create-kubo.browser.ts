import { createNode } from 'ipfsd-ctl'
import { create as kuboRpcClient } from 'kubo-rpc-client'
import type { KuboNode } from 'ipfsd-ctl'

export async function createKuboNode (): Promise<KuboNode> {
  return createNode({
    type: 'kubo',
    rpc: kuboRpcClient,
    test: true,
    endpoint: process.env.IPFSD_SERVER,
    init: {
      // Mirror create-kubo.ts: pin the unixfs-v1-2025 import profile (IPIP-499)
      // so browser-mode interop produces the same deterministic CIDs.
      profiles: ['unixfs-v1-2025'],
      config: {
        Addresses: {
          Swarm: [
            '/ip4/0.0.0.0/tcp/0',
            '/ip4/0.0.0.0/tcp/0/ws'
          ],
          Gateway: '/ip4/127.0.0.1/tcp/0'
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
