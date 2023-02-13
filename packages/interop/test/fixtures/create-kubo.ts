
// @ts-expect-error no types
import * as goIpfs from 'go-ipfs'
import { Controller, createController } from 'ipfsd-ctl'
import * as kuboRpcClient from 'kubo-rpc-client'
import { isElectronMain, isNode } from 'wherearewe'

export async function createKuboNode (): Promise<Controller> {
  return await createController({
    kuboRpcModule: kuboRpcClient,
    ipfsBin: isNode || isElectronMain ? goIpfs.path() : undefined,
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
