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
      // Pin the unixfs-v1-2025 import profile (IPIP-499,
      // https://specs.ipfs.tech/ipips/ipip-0499/) so every interop test uses
      // the same CIDv1 / 1 MiB-chunk import settings regardless of the Kubo
      // version's default (Kubo <= 0.42 defaults to CIDv0). Keeps CID-based
      // assertions deterministic; the profile has existed since Kubo v0.40.
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
