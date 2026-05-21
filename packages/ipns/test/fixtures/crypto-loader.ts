import { ed25519Crypto, rsaCrypto } from '@helia/utils'
import type { CryptoKeyLoader } from '@helia/interface'
import type { AbortOptions } from 'abort-error'

export const getCryptoKey: CryptoKeyLoader = async (code: number | string, options?: AbortOptions) => {
  if (code === 0 || code === 'RSA') {
    return rsaCrypto()
  }

  if (code === 1 || code === 'Ed25519') {
    return ed25519Crypto()
  }

  throw new Error(`Unknown crypto implementation ${code}`)
}
