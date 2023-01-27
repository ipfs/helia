import type { Multiaddr } from '@multiformats/multiaddr'
import { InvalidParametersError } from '@helia/interface/errors'

export function multiaddrToUrl (addr: Multiaddr): URL {
  const protoNames = addr.protoNames()

  if (protoNames.length !== 3) {
    throw new InvalidParametersError('Helia RPC address format incorrect')
  }

  if (protoNames[0] !== 'ip4' && protoNames[0] !== 'ip6') {
    throw new InvalidParametersError('Helia RPC address format incorrect')
  }

  if (protoNames[1] !== 'tcp' && protoNames[2] !== 'ws') {
    throw new InvalidParametersError('Helia RPC address format incorrect')
  }

  const { host, port } = addr.toOptions()

  return new URL(`ws://${host}:${port}`)
}
