import { ed25519Crypto, rsaCrypto } from '../../src/crypto/index.ts'
import { UnsupportedCryptographyImplementationError } from '../../src/errors.ts'
import type { CryptoKeyLoader } from '@helia/interface'
import type { AbortOptions } from 'abort-error'

export const getCryptoKey: CryptoKeyLoader = async (code: number | string, options?: AbortOptions) => {
  if (code === 0 || code === 'RSA') {
    return rsaCrypto()
  }

  if (code === 1 || code === 'Ed25519') {
    return ed25519Crypto()
  }

  throw new UnsupportedCryptographyImplementationError(`Unknown crypto implementation ${code}`)
}
