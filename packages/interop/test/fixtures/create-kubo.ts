// @ts-expect-error no types
import * as goIpfs from 'go-ipfs'
import { type Controller, type ControllerOptions, createController } from 'ipfsd-ctl'
import * as kuboRpcClient from 'kubo-rpc-client'
import mergeOptions from 'merge-options'
import { isElectronMain, isNode } from 'wherearewe'

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
            '/ip4/0.0.0.0/tcp/4001',
            '/ip4/0.0.0.0/tcp/4002/ws'
          ]
        }
      }
    }
  }, options)

  return createController(opts)
}
