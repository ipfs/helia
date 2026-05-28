import { ed25519Crypto, rsaCrypto } from '@ipshipyard/crypto'
import type { CryptoLoader } from '@helia/interface'
import type { AbortOptions } from 'abort-error'

export const getCrypto: CryptoLoader = async (code: number | string, options?: AbortOptions) => {
  options?.signal?.throwIfAborted()

  if (code === 0 || code === 'RSA') {
    return rsaCrypto()
  }

  if (code === 1 || code === 'Ed25519') {
    return ed25519Crypto()
  }

  throw new Error(`Unknown crypto implementation ${code}`)
}
