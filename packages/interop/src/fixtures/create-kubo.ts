import { createNode } from 'ipfsd-ctl'
import { path as kuboPath } from 'kubo'
import { create as kuboRpcClient } from 'kubo-rpc-client'
import { raceSignal } from 'race-signal'
import type { KuboNode } from 'ipfsd-ctl'

export async function createKuboNode (): Promise<KuboNode> {
  const ms = 30_000
  const timeout = AbortSignal.timeout(ms)

  return raceSignal(createNode({
    type: 'kubo',
    rpc: kuboRpcClient,
    bin: kuboPath(),
    test: true,
    init: {
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
    },
    env: {
      IPFS_LOGGING: 'debug'
    }
  }), timeout, {
    translateError (signal) {
      if (timeout.aborted) {
        return new Error(`Kubo failed to start after ${ms/1000}s`)
      }

      return signal.reason
    }
  })
}
