import { createNode, type KuboNode } from 'ipfsd-ctl'
import { path as kuboPath } from 'kubo'
import { create as kuboRpcClient } from 'kubo-rpc-client'

export async function getKubo (): Promise<KuboNode> {
  const listen = `${process.env.HELIA_LISTEN ?? ''}`.split(',').filter(Boolean)

  return createNode({
    type: 'kubo',
    test: true,
    bin: kuboPath(),
    rpc: kuboRpcClient,
    repo: process.env.HELIA_REPO,
    init: {
      emptyRepo: true,
      config: {
        Addresses: {
          Swarm: listen
        }
      }
    }
  })
}
