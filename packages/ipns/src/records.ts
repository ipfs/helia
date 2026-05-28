import { logger } from '@libp2p/logger'
import NanoDate from 'timestamp-nano'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { SignatureCreationError } from './errors.ts'
import { IpnsEntry } from './pb/ipns.ts'
import { createCborData, ipnsRecordDataForV1Sig, ipnsRecordDataForV2Sig, marshalIPNSRecord } from './utils.ts'
import type { PrivateKey, PublicKey } from '@helia/interface'
import type { AbortOptions } from 'abort-error'
import type { Key } from 'interface-datastore/key'

const log = logger('ipns')
const DEFAULT_TTL_NS = 5 * 60 * 1e+9 // 5 Minutes or 300 Seconds, as suggested by https://specs.ipfs.tech/ipns/ipns-record/#ttl-uint64

export const namespace = '/ipns/'
export const namespaceLength = namespace.length

export interface IPNSRecordV1V2 {
  /**
   * value of the record
   */
  value: string

  /**
   * signature of the record
   */
  signatureV1: Uint8Array

  /**
   * Type of validation being used
   */
  validityType: IpnsEntry.ValidityType

  /**
   * expiration datetime for the record in RFC3339 format
   */
  validity: string

  /**
   * number representing the version of the record
   */
  sequence: bigint

  /**
   * ttl in nanoseconds
   */
  ttl?: bigint

  /**
   * the public portion of the key that signed this record
   */
  publicKey: PublicKey

  /**
   * the v2 signature of the record
   */
  signatureV2: Uint8Array

  /**
   * extensible data
   */
  data: Uint8Array

  /**
   * The marshalled record
   */
  bytes: Uint8Array
}

export interface IPNSRecordV2 {
  /**
   * value of the record
   */
  value: string

  /**
   * the v2 signature of the record
   */
  signatureV2: Uint8Array

  /**
   * Type of validation being used
   */
  validityType: IpnsEntry.ValidityType

  /**
   * If the validity type is EOL, this is the expiration datetime for the record
   * in RFC3339 format
   */
  validity: string

  /**
   * number representing the version of the record
   */
  sequence: bigint

  /**
   * ttl in nanoseconds
   */
  ttl?: bigint

  /**
   * the public portion of the key that signed this record
   */
  publicKey: PublicKey

  /**
   * extensible data
   */
  data: Uint8Array

  /**
   * The marshalled record
   */
  bytes: Uint8Array
}

export type IPNSRecord = IPNSRecordV1V2 | IPNSRecordV2

export interface IPNSRecordData {
  Value: Uint8Array
  Validity: Uint8Array
  ValidityType: IpnsEntry.ValidityType
  Sequence: bigint
  TTL: bigint
}

export interface IDKeys {
  routingPubKey: Key
  pkKey: Key
  routingKey: Key
  ipnsKey: Key
}

export interface CreateOptions extends AbortOptions {
  ttlNs?: number | bigint
  v1Compatible?: boolean
}

export interface CreateV2OrV1Options extends AbortOptions {
  v1Compatible: true
}

export interface CreateV2Options extends AbortOptions {
  v1Compatible: false
}

const defaultCreateOptions: CreateOptions = {
  v1Compatible: true,
  ttlNs: DEFAULT_TTL_NS
}

/**
 * Creates a new IPNS record and signs it with the given private key.
 * The IPNS Record validity should follow the [RFC3339]{@link https://www.ietf.org/rfc/rfc3339.txt} with nanoseconds precision.
 * Note: This function does not embed the public key. If you want to do that, use `EmbedPublicKey`.
 *
 * The passed value can be a CID, a PublicKey or an arbitrary string path e.g. `/ipfs/...` or `/ipns/...`.
 *
 * CIDs will be converted to v1 and stored in the record as a string similar to: `/ipfs/${cid}`
 * PublicKeys will create recursive records, eg. the record value will be `/ipns/${cidV1Libp2pKey}`
 * String paths will be stored in the record as-is, but they must start with `"/"`
 *
 * @param {PrivateKey} privateKey - the private key for signing the record.
 * @param {CID | PublicKey | string} value - content to be stored in the record.
 * @param {number | bigint} seq - number representing the current version of the record.
 * @param {number} lifetime - lifetime of the record (in milliseconds).
 * @param {CreateOptions} options - additional create options.
 */
export async function createIPNSRecord (privateKey: PrivateKey, value: string, seq: number | bigint, lifetime: number, options?: CreateV2OrV1Options): Promise<IPNSRecordV1V2>
export async function createIPNSRecord (privateKey: PrivateKey, value: string, seq: number | bigint, lifetime: number, options: CreateV2Options): Promise<IPNSRecordV2>
export async function createIPNSRecord (privateKey: PrivateKey, value: string, seq: number | bigint, lifetime: number, options: CreateOptions): Promise<IPNSRecordV1V2>
export async function createIPNSRecord (privateKey: PrivateKey, value: string, seq: number | bigint, lifetime: number, options: CreateOptions = defaultCreateOptions): Promise<IPNSRecord> {
  // Validity in ISOString with nanoseconds precision and validity type EOL
  const expirationDate = new NanoDate(Date.now() + Number(lifetime))
  const validityType = IpnsEntry.ValidityType.EOL
  const ttlNs = BigInt(options.ttlNs ?? DEFAULT_TTL_NS)

  return _create(privateKey, value, seq, validityType, expirationDate.toString(), ttlNs, options)
}

/**
 * Same as create(), but instead of generating a new Date, it receives the intended expiration time
 * WARNING: nano precision is not standard, make sure the value in seconds is 9 orders of magnitude lesser than the one provided.
 *
 * The passed value can be a CID, a PublicKey or an arbitrary string path e.g. `/ipfs/...` or `/ipns/...`.
 *
 * CIDs will be converted to v1 and stored in the record as a string similar to: `/ipfs/${cid}`
 * PublicKeys will create recursive records, eg. the record value will be `/ipns/${cidV1Libp2pKey}`
 * String paths will be stored in the record as-is, but they must start with `"/"`
 *
 * @param {PrivateKey} privateKey - the private key for signing the record.
 * @param {CID | PublicKey | string} value - content to be stored in the record.
 * @param {number | bigint} seq - number representing the current version of the record.
 * @param {string} expiration - expiration datetime for record in the [RFC3339]{@link https://www.ietf.org/rfc/rfc3339.txt} with nanoseconds precision.
 * @param {CreateOptions} options - additional creation options.
 */
export async function createIPNSRecordWithExpiration (privateKey: PrivateKey, value: string, seq: number | bigint, expiration: string, options?: CreateV2OrV1Options): Promise<IPNSRecordV1V2>
export async function createIPNSRecordWithExpiration (privateKey: PrivateKey, value: string, seq: number | bigint, expiration: string, options: CreateV2Options): Promise<IPNSRecordV2>
export async function createIPNSRecordWithExpiration (privateKey: PrivateKey, value: string, seq: number | bigint, expiration: string, options: CreateOptions): Promise<IPNSRecordV1V2>
export async function createIPNSRecordWithExpiration (privateKey: PrivateKey, value: string, seq: number | bigint, expiration: string, options: CreateOptions = defaultCreateOptions): Promise<IPNSRecord> {
  const expirationDate = NanoDate.fromString(expiration)
  const validityType = IpnsEntry.ValidityType.EOL
  const ttlNs = BigInt(options.ttlNs ?? DEFAULT_TTL_NS)

  return _create(privateKey, value, seq, validityType, expirationDate.toString(), ttlNs, options)
}

const _create = async (privateKey: PrivateKey, value: string, seq: number | bigint, validityType: IpnsEntry.ValidityType, validity: string, ttl: bigint, options: CreateOptions = defaultCreateOptions): Promise<IPNSRecord> => {
  seq = BigInt(seq)
  const isoValidity = uint8ArrayFromString(validity)
  const data = createCborData(value, validityType, isoValidity, seq, ttl)
  const sigData = ipnsRecordDataForV2Sig(data)
  const signatureV2 = await privateKey.sign(sigData, options)
  const publicKey = shouldEmbedPublicKey(privateKey.publicKey) ? privateKey.publicKey : undefined
  let record: any

  if (options.v1Compatible === true) {
    const signatureV1 = await signLegacyV1(privateKey, value, validityType, isoValidity)

    record = {
      value,
      signatureV1,
      validity,
      validityType,
      sequence: seq,
      ttl,
      signatureV2,
      data,
      publicKey
    }
  } else {
    record = {
      value,
      validity,
      validityType,
      sequence: seq,
      ttl,
      signatureV2,
      data,
      publicKey
    }
  }

  record.bytes = marshalIPNSRecord(record)

  return record
}

export { unmarshalIPNSRecord } from './utils.ts'
export { marshalIPNSRecord } from './utils.ts'
export { multihashToIPNSRoutingKey } from './utils.ts'
export { multihashFromIPNSRoutingKey } from './utils.ts'

/**
 * Sign ipns record data using the legacy V1 signature scheme
 */
const signLegacyV1 = async (privateKey: PrivateKey, value: string, validityType: IpnsEntry.ValidityType, validity: Uint8Array, options?: AbortOptions): Promise<Uint8Array> => {
  try {
    const dataForSignature = ipnsRecordDataForV1Sig(value, validityType, validity)

    return await privateKey.sign(dataForSignature, options)
  } catch (error: any) {
    log.error('record signature creation failed', error)
    throw new SignatureCreationError('Record signature creation failed')
  }
}

/**
 * Returns true if the public key multihash is not an identity hash
 */
function shouldEmbedPublicKey (key: PublicKey): boolean {
  return key.toMultihash().code !== 0
}
