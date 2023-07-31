// @ts-expect-error no types
import * as goIpfs from 'go-ipfs'
import { type Controller, createController } from 'ipfsd-ctl'
import * as kuboRpcClient from 'kubo-rpc-client'

export async function createKuboNode (): Promise<Controller> {
  return createController({
    kuboRpcModule: kuboRpcClient,
    ipfsBin: process.env.KUBO_BINARY ? process.env.KUBO_BINARY : goIpfs.path(),
    test: true,
    ipfsOptions: {
      config: {
        Addresses: {
          Swarm: [
            '/ip4/0.0.0.0/tcp/0',
            '/ip4/0.0.0.0/tcp/0/ws',
            "/ip4/0.0.0.0/udp/0/quic-v1/webtransport"
          ]
        }
      }
    }
  })
}
