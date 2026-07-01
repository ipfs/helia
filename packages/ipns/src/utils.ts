import { isPublicKey } from '@helia/interface'
import * as dagCbor from '@ipld/dag-cbor'
import { InvalidParametersError } from '@libp2p/interface'
import { Key } from 'interface-datastore'
import { base36 } from 'multiformats/bases/base36'
import { base58btc } from 'multiformats/bases/base58'
import { CID } from 'multiformats/cid'
import * as Digest from 'multiformats/hashes/digest'
import { concat as uint8ArrayConcat } from 'uint8arrays/concat'
import { equals as uint8ArrayEquals } from 'uint8arrays/equals'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { withArrayBuffer } from 'uint8arrays/with-array-buffer'
import { DHT_EXPIRY_MS, REPUBLISH_THRESHOLD } from './constants.ts'
import { InvalidRecordDataError, InvalidValueError, SignatureVerificationError, UnsupportedValidityError } from './errors.ts'
import { IPNSEntry } from './pb/ipns.ts'
import type { IPNSRecordData } from './index.ts'
import type { PublicKey } from '@helia/interface'
import type { MultibaseDecoder } from 'multiformats/cid'
import type { MultihashDigest } from 'multiformats/hashes/interface'

export const LIBP2P_KEY_CODEC = 0x72
export const IDENTITY_CODEC = 0x0
export const SHA2_256_CODEC = 0x12

const IPNS_PREFIX = uint8ArrayFromString('/ipns/')
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

export function shouldRepublish (created: Date, expiry: Date): boolean {
  const now = Date.now()
  const dhtExpiry = created.getTime() + DHT_EXPIRY_MS

  // If the DHT expiry is within the threshold, republish it
  if (dhtExpiry - now < REPUBLISH_THRESHOLD) {
    return true
  }

  // If the record expiry (based on validity/lifetime) is within the threshold, republish it
  if (expiry.getTime() - now < REPUBLISH_THRESHOLD) {
    return true
  }

  return false
}

function isCID (obj?: any): obj is CID {
  return obj?.asCID === obj
}

export function isLibp2pCID (obj?: any): obj is CID<unknown, 0x72, 0x00 | 0x12, 1> {
  if (!isCID(obj)) {
    return false
  }

  if (obj.code !== LIBP2P_KEY_CODEC) {
    throw new InvalidParametersError(`CID codec ${obj.code} was not libp2p-key`)
  }

  if (obj.multihash.code !== IDENTITY_CODEC && obj.multihash.code !== SHA2_256_CODEC) {
    throw new InvalidParametersError(`Multihash algorithm codec ${obj.multihash.code} was not Identity or SHA256 hash`)
  }

  return true
}

/**
 * Utility for creating the record data for being signed
 */
export function ipnsRecordDataForV1Sig (value: Uint8Array, validityType: IPNSEntry.ValidityType, validity: Uint8Array): Uint8Array {
  const validityTypeBuffer = uint8ArrayFromString(validityType)

  return uint8ArrayConcat([
    value,
    validity,
    validityTypeBuffer
  ], value.byteLength + validity.byteLength + validityTypeBuffer.byteLength)
}

/**
 * Utility for creating the record data for being signed
 */
export function ipnsRecordDataForV2Sig (data: Uint8Array): Uint8Array {
  const entryData = uint8ArrayFromString('ipns-signature:')

  return uint8ArrayConcat([entryData, data])
}

export function ipnsRecordValueToString (value: Uint8Array): string {
  // handle legacy case where record value is raw CID bytes
  try {
    const cid = CID.decode(value)
    return `/ipfs/${cid}`
  } catch {
    // ignore error
  }

  return uint8ArrayToString(value)
}

export function multihashToIPNSRoutingKey (digest: MultihashDigest): Uint8Array {
  return uint8ArrayConcat([
    IPNS_PREFIX,
    digest.bytes
  ])
}

export function multihashFromIPNSRoutingKey (key: Uint8Array): MultihashDigest {
  return Digest.decode(key.slice(IPNS_PREFIX.length))
}

export function encodeExtensibleData (data?: IPNSRecordData): Uint8Array<ArrayBuffer> {
  return withArrayBuffer(dagCbor.encode(data))
}

export function decodeExtensibleData (buf?: Uint8Array): IPNSRecordData {
  if (buf == null) {
    throw new InvalidRecordDataError('Record data is missing')
  }

  const data = dagCbor.decode<IPNSRecordData>(buf)

  // @ts-expect-error TODO: remove typescript enums
  if (data.ValidityType === 0) {
    data.ValidityType = IPNSEntry.ValidityType.EOL
  }

  if (data.ValidityType !== IPNSEntry.ValidityType.EOL) {
    throw new UnsupportedValidityError('The validity type is unsupported')
  }

  if (Number.isInteger(data.Sequence)) {
    // sequence must be a BigInt, but DAG-CBOR doesn't preserve this for Numbers within the safe-integer range
    data.Sequence = BigInt(data.Sequence)
  }

  if (Number.isInteger(data.TTL)) {
    // ttl must be a BigInt, but DAG-CBOR doesn't preserve this for Numbers within the safe-integer range
    data.TTL = BigInt(data.TTL)
  }

  return data
}

/**
 * Normalizes the given record value. It ensures it is a PeerID, a CID or a
 * string starting with '/'. PeerIDs become `/ipns/${cidV1Libp2pKey}`,
 * CIDs become `/ipfs/${cidAsV1}`.
 */
export function normalizeValue (value?: PublicKey | CID | MultihashDigest | string): string {
  if (value != null) {
    if (isPublicKey(value)) {
      return `/ipns/${value.toCID().toV1().toString(base36)}`
    }

    const cid = asCID(value)

    // if we have a CID, turn it into an ipfs path
    if (cid != null) {
      // PeerID encoded as a CID
      if (cid.code === LIBP2P_KEY_CODEC) {
        return `/ipns/${cid.toV1().toString(base36)}`
      }

      return `/ipfs/${cid.toV1()}`
    }

    if (hasBytes(value)) {
      return `/ipns/${base36.encode(value.bytes)}`
    }

    // if we have a path, check it is a valid path
    const string = value.toString().trim()

    if (string.startsWith('/ipfs/')) {
      const [, name, ...rest] = string.split('/')
        .filter(component => component.trim() !== '')

      return `/ipfs/${CID.parse(name).toV1()}${rest.length > 0 ? `/${rest.join('/')}` : ''}`
    }

    if (string.startsWith('/') && string.length > 1) {
      return string
    }
  }

  throw new InvalidValueError('Value must be a valid content path starting with /')
}

function isMultihashDigest (obj: any): obj is MultihashDigest {
  return typeof obj.code === 'number' && obj.digest instanceof Uint8Array && typeof obj.size === 'number' && obj.bytes instanceof Uint8Array
}

export function normalizeKey (key?: PublicKey | CID | MultihashDigest | string): { digest: MultihashDigest, path: string } {
  if (key != null) {
    if (isPublicKey(key)) {
      return {
        digest: key.toMultihash(),
        path: '/'
      }
    }

    const cid = asCID(key)

    // if we have a CID, turn it into an ipfs path
    if (cid != null) {
      // PeerID encoded as a CID
      if (cid.code !== LIBP2P_KEY_CODEC) {
        throw new InvalidValueError('CIDs must have the `libp2p-key` codec')
      }

      return {
        digest: cid.multihash,
        path: '/'
      }
    }

    if (isMultihashDigest(key)) {
      return {
        digest: key,
        path: '/'
      }
    }

    key = key.toString()

    if (key.startsWith('/ipns/')) {
      let [,, name, ...rest] = key.split('/')
      let codec: MultibaseDecoder<any> = base36

      // base58btc encoded public key hash or protobuf in identity hash
      if (name.startsWith('1') || name.startsWith('Q')) {
        name = `z${name}`
        codec = base58btc
      }

      const buf = codec.decode(name)
      let digest: MultihashDigest

      try {
        digest = CID.decode(buf).multihash
      } catch {
        digest = Digest.decode(buf)
      }

      return {
        digest,
        path: `/${rest.join('/')}`
      }
    }
  }

  throw new InvalidValueError('Value must be a valid IPNS path starting with /')
}

export function validateCborDataMatchesPbData (entry: IPNSEntry, data: IPNSRecordData): void {
  if (!uint8ArrayEquals(data.Value, entry.value ?? new Uint8Array(0))) {
    throw new SignatureVerificationError('Field "value" did not match between protobuf and CBOR')
  }

  if (!uint8ArrayEquals(data.Validity, entry.validity ?? new Uint8Array(0))) {
    throw new SignatureVerificationError('Field "validity" did not match between protobuf and CBOR')
  }

  if (data.ValidityType !== entry.validityType) {
    throw new SignatureVerificationError('Field "validityType" did not match between protobuf and CBOR')
  }

  if (data.Sequence !== entry.sequence) {
    throw new SignatureVerificationError('Field "sequence" did not match between protobuf and CBOR')
  }

  if (data.TTL !== entry.ttl) {
    throw new SignatureVerificationError('Field "ttl" did not match between protobuf and CBOR')
  }
}

function hasBytes (obj?: any): obj is { bytes: Uint8Array } {
  return obj.bytes instanceof Uint8Array
}

function hasToCID (obj?: any): obj is { toCID(): CID } {
  return typeof obj?.toCID === 'function'
}

function asCID (obj?: any): CID | null {
  if (hasToCID(obj)) {
    return obj.toCID()
  }

  // try parsing as a CID string
  try {
    return CID.parse(obj)
  } catch {
    // fall through
  }

  return CID.asCID(obj)
}
