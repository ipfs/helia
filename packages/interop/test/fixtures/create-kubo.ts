/* eslint-disable @typescript-eslint/ban-ts-comment,@typescript-eslint/prefer-ts-expect-error */
// @ts-ignore no types - TODO: remove me once the next version of npm-go-ipfs has shipped
import * as goIpfs from 'go-ipfs'
import { type Controller, createController } from 'ipfsd-ctl'
import * as kuboRpcClient from 'kubo-rpc-client'

export async function createKuboNode (): Promise<Controller> {
  return createController({
    kuboRpcModule: kuboRpcClient,
    ipfsBin: goIpfs.path(),
    test: true,
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
