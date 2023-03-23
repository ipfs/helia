
// @ts-expect-error no types
import * as goIpfs from 'go-ipfs'
import { Controller, ControllerOptions, createController } from 'ipfsd-ctl'
import * as kuboRpcClient from 'kubo-rpc-client'
import { isElectronMain, isNode } from 'wherearewe'
import mergeOptions from 'merge-options'

export async function createKuboNode (options: ControllerOptions<'go'> = {}): Promise<Controller> {
  const opts = mergeOptions({
    kuboRpcModule: kuboRpcClient,
    ipfsBin: isNode || isElectronMain ? goIpfs.path() : undefined,
    test: true,
    endpoint: process.env.IPFSD_SERVER,
    ipfsOptions: {
      config: {
        Addresses: {
          Swarm: [
            '/ip4/127.0.0.1/tcp/4001',
            '/ip4/127.0.0.1/tcp/4002/ws'
          ]
        }
      }
    }
  }, options)

  return await createController(opts)
}
