// import type { Controller } from 'ipfsd-ctl'
import { type create } from 'kubo-rpc-client'

export async function importContentToKuboNode (rpcClient: ReturnType<typeof create>, path: Parameters<ReturnType<typeof create>['refs']>[0]): Promise<ReturnType<ReturnType<typeof create>['refs']>> {
  return rpcClient.refs(path, { recursive: true })
}
