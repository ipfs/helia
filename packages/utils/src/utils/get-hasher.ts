import { UnknownHashAlgorithmError } from '@helia/interface'
import { identity } from 'multiformats/hashes/identity'
import { sha256, sha512 } from 'multiformats/hashes/sha2'
import { isPromise } from './is-promise.js'
import type { Await } from '@helia/interface'
import type { MultihashHasher } from 'multiformats/hashes/interface'

export function getHasher (initialHashers: MultihashHasher[] = [], loadHasher?: (code: number) => Await<MultihashHasher>): (code: number) => Await<MultihashHasher> {
  const hashers: Record<number, MultihashHasher> = {
    [sha256.code]: sha256,
    [sha512.code]: sha512,
    [identity.code]: identity
  }

  initialHashers.forEach(hasher => {
    hashers[hasher.code] = hasher
  })

  return async (code) => {
    let hasher = hashers[code]

    if (hasher == null && loadHasher != null) {
      const res = loadHasher(code)

      if (isPromise(res)) {
        hasher = await res
      } else {
        hasher = res
      }

      hashers[hasher.code] = hasher
    }

    if (hasher != null) {
      return hasher
    }

    throw new UnknownHashAlgorithmError(`No hasher configured for multihash code 0x${code.toString(16)}, please configure one. You can look up which hash this is at https://github.com/multiformats/multicodec/blob/master/table.csv`)
  }
}
