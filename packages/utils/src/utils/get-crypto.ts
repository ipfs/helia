import { UnknownCryptoError } from '@helia/interface'
import { ecdsaCrypto, ed25519Crypto, rsaCrypto } from '@ipshipyard/crypto'
import { isPromise } from './is-promise.ts'
import type { CryptoLoader } from '@helia/interface'
import type { Crypto } from '@ipshipyard/crypto'

export function getCrypto (initialCryptos: Array<Crypto> = [], loadCrypto?: CryptoLoader): CryptoLoader {
  const cryptos: Record<string | number, Crypto> = {}

  initialCryptos = [
    ecdsaCrypto(),
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
