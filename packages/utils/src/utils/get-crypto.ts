import { UnknownCryptoError } from '@helia/interface'
import { ed25519Crypto, rsaCrypto } from '../crypto/index.ts'
import { isPromise } from './is-promise.ts'
import type { CryptoKeyImplementation, CryptoKeyLoader } from '@helia/interface'

export function getCryptoKey (initialCryptos: Array<CryptoKeyImplementation> = [], loadCrypto?: CryptoKeyLoader): CryptoKeyLoader {
  const cryptos: Record<string | number, CryptoKeyImplementation> = {}

  initialCryptos = [
    ed25519Crypto(),
    rsaCrypto(),
    ...initialCryptos
  ]

  initialCryptos.forEach(crypto => {
    cryptos[crypto.type] = crypto
    cryptos[crypto.code] = crypto
  })

  return async (nameOrCode) => {
    let crypto = cryptos[nameOrCode]

    if (crypto == null && loadCrypto != null) {
      const res = loadCrypto(nameOrCode)

      if (isPromise(res)) {
        crypto = await res
      } else {
        crypto = res
      }

      cryptos[crypto.type] = crypto
      cryptos[crypto.code] = crypto
    }

    if (crypto != null) {
      return crypto
    }

    throw new UnknownCryptoError(`Could not load crypto for ${crypto}`)
  }
}
