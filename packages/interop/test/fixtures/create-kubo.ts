import { type Controller, type ControllerOptions, createController } from 'ipfsd-ctl'
import * as kubo from 'kubo'
import * as kuboRpcClient from 'kubo-rpc-client'
import mergeOptions from 'merge-options'
import { isElectronMain, isNode } from 'wherearewe'

export async function createKuboNode (options: ControllerOptions<'go'> = {}): Promise<Controller> {
  const opts = mergeOptions({
    kuboRpcModule: kuboRpcClient,
    ipfsBin: isNode || isElectronMain ? kubo.path() : undefined,
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

  return createController(opts)
}
