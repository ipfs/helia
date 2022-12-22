import type { RPCCallResponse } from './rpc.js'

export const HELIA_RPC_PROTOCOL = '/helia-rpc/0.0.1'

export class RPCError extends Error {
  public readonly name: string
  public readonly code: string

  constructor (response: RPCCallResponse) {
    super(response.errorMessage ?? 'RPC error')

    this.name = response.errorName ?? 'RPCError'
    this.code = response.errorCode ?? 'ERR_RPC_ERROR'
    this.stack = response.errorStack ?? this.stack
  }
}
