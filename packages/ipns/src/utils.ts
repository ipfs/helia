import type { MultihashDigest } from 'multiformats/hashes/interface'
import { Key } from 'interface-datastore'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'

export const IDENTITY_CODEC = 0x0
export const SHA2_256_CODEC = 0x12

export const IPNS_STRING_PREFIX = '/ipns/'

export function isCodec <T extends number> (digest: MultihashDigest, codec: T): digest is MultihashDigest<T> {
  return digest.code === codec
}

export const DHT_RECORD_PREFIX = '/dht/record/'
export const KEYCHAIN_NAME_PREFIX = '/ipns/keyname/'

export function dhtRoutingKey (key: Uint8Array): Key {
  return new Key(DHT_RECORD_PREFIX + uint8ArrayToString(key, 'base32'), false)
}


export function keychainNameKey (key: Uint8Array): Key {
  return new Key(KEYCHAIN_NAME_PREFIX + uint8ArrayToString(key, 'base32'), false)
}

export function keyNameToKeyId (keyName: string): string {
  return keyName.split('/').pop() ?? keyName
}
