import { identity } from 'multiformats/hashes/identity'
import { sha256, sha512 } from 'multiformats/hashes/sha2'
import type { MultihashHasher } from 'multiformats/hashes/interface'

export function defaultHashers (hashers: MultihashHasher[] = []): Record<number, MultihashHasher> {
  const output: Record<number, MultihashHasher> = {}

  ;[
    sha256,
    sha512,
    identity,
    ...hashers
  ].forEach(hasher => {
    output[hasher.code] = hasher
  })

  return output
}
