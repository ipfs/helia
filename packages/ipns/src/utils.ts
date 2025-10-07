import { Key } from 'interface-datastore'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { DHT_EXPIRY_MS, REPUBLISH_THRESHOLD } from './constants.ts'
import type { IPNSRecord } from 'ipns'
import type { MultihashDigest } from 'multiformats/hashes/interface'

export const IDENTITY_CODEC = 0x0
export const SHA2_256_CODEC = 0x12

export const IPNS_STRING_PREFIX = '/ipns/'

export function isCodec <T extends number> (digest: MultihashDigest, codec: T): digest is MultihashDigest<T> {
  return digest.code === codec
}

export const DHT_RECORD_PREFIX = '/dht/record/'
export const IPNS_METADATA_PREFIX = '/ipns/metadata/'

export function dhtRoutingKey (key: Uint8Array): Key {
  return new Key(DHT_RECORD_PREFIX + uint8ArrayToString(key, 'base32'), false)
}

/**
 * Calculate the datastore key for IPNS record metadata
 *
 * @param key - The DHT routing key for the IPNS record as defined in
 * https://specs.ipfs.tech/ipns/ipns-record/#routing-record
 *
 * @example
 *
 * ```ts
 * const key = multihashToIPNSRoutingKey(privKey.publicKey.toMultihash())
 * const metadataKey = ipnsMetadataKey(key)
 * ```
 * @returns The local storage key for IPNS record metadata
 */
export function ipnsMetadataKey (key: Uint8Array): Key {
  return new Key(IPNS_METADATA_PREFIX + uint8ArrayToString(key, 'base32'), false)
}

export function shouldRepublish (ipnsRecord: IPNSRecord, created: Date): boolean {
  const now = Date.now()
  const dhtExpiry = created.getTime() + DHT_EXPIRY_MS
  const recordExpiry = new Date(ipnsRecord.validity).getTime()

  // If the DHT expiry is within the threshold, republish it
  if (dhtExpiry - now < REPUBLISH_THRESHOLD) {
    return true
  }

  // If the record expiry (based on validity/lifetime) is within the threshold, republish it
  if (recordExpiry - now < REPUBLISH_THRESHOLD) {
    return true
  }

  return false
}
