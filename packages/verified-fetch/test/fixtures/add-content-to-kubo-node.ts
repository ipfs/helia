import { type create } from 'kubo-rpc-client'

export async function addContentToKuboNode (rpcClient: ReturnType<typeof create>, content: any): Promise<ReturnType<ReturnType<typeof create>['add']>> {
  return rpcClient.add(content, { cidVersion: 1, pin: false })
}
