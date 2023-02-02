import { RPCCallError, RPCCallProgress } from './rpc.js'

export const HELIA_RPC_PROTOCOL = '/helia-rpc/0.0.1'

export class RPCError extends Error {
  public readonly name: string
  public readonly code: string

  constructor (buf: Uint8Array) {
    const message = RPCCallError.decode(buf)

    super(message.message ?? 'RPC error')

    this.name = message.name ?? 'RPCError'
    this.code = message.code ?? 'ERR_RPC_ERROR'
    this.stack = message.stack ?? this.stack
  }
}

export class RPCProgressEvent extends Event {
  constructor (buf: Uint8Array) {
    const event = RPCCallProgress.decode(buf)

    super(event.event ?? 'ProgressEvent')

    for (const [key, value] of event.data) {
      // @ts-expect-error cannot use strings to index this type
      this[key] = value
    }
  }
}
