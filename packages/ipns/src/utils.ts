import type { MultihashDigest } from 'multiformats/hashes/interface'

export const IDENTITY_CODEC = 0x0
export const SHA2_256_CODEC = 0x12

export const IPNS_STRING_PREFIX = '/ipns/'

export function isCodec <T extends number> (digest: MultihashDigest, codec: T): digest is MultihashDigest<T> {
  return digest.code === codec
}
