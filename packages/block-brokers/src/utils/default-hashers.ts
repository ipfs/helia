import { identity } from 'multiformats/hashes/identity'
import { sha256, sha512 } from 'multiformats/hashes/sha2'
import type { MultihashHasher } from 'multiformats/hashes/interface'

export function defaultHashers (hashers: MultihashHasher[] = []): MultihashHasher[] {
  return [
    sha256,
    sha512,
    identity,
    ...hashers
  ]
}
