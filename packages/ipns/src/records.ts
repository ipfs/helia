import { logger } from '@libp2p/logger'
import NanoDate from 'timestamp-nano'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { SignatureCreationError } from './errors.ts'
import { IPNSEntry } from './pb/ipns.ts'
import { encodeExtensibleData, IDENTITY_CODEC, ipnsRecordDataForV1Sig, ipnsRecordDataForV2Sig } from './utils.ts'
import type { PrivateKey, PublicKey } from '@helia/interface'
import type { AbortOptions } from 'abort-error'

const log = logger('ipns')
const DEFAULT_TTL_NS = 300_000_000_000n // 5 Minutes or 300 Seconds, as suggested by https://specs.ipfs.tech/ipns/ipns-record/#ttl-uint64

export interface CreateIPNSRecordOptions extends AbortOptions {
  /**
   * By default a IPNS V1 and a V2 signature is added to every record. Pass
   * false here to only add a V2 signature.
   *
   * @default true
   */
  v1Compatible?: boolean

  /**
   * The TTL of the record in ms - after this many ms have expired, resolving
   * the record will query the routing for an updated version.
   *
   * Before this many ms have expired any locally stored copy will be treated as
   * the latest version and the routing will not be queried.
   *
   * @default 300_000_000_000n
   */
  ttlNs?: bigint

  /**
   * Extensible data that will be added to the IPNS record data and signed to
   * verify it's integrity.
   *
   * Note that this data will be encoded as DAG-CBOR so it must be valid.
   */
  data?: Record<string, any>
}

/**
 * A low-level function that creates a new IPNS record and signs it with the
 * passed private key.
 *
 * The IPNS Record validity should follow the [RFC3339]{@link https://www.ietf.org/rfc/rfc3339.txt}
 * with nanosecond precision.
 *
 * The passed value should be a string path e.g. `/ipfs/...` or `/ipns/...`.
 */
export async function createIPNSRecord (privateKey: PrivateKey, val: string, seq: number | bigint, lifetime: number, options?: CreateIPNSRecordOptions): Promise<IPNSEntry> {
  seq = BigInt(seq)
  const value = uint8ArrayFromString(val)
  // convert ttl from milliseconds to nanoseconds as createIPNSRecord expects
  const ttlNs = options?.ttlNs ?? DEFAULT_TTL_NS

  // Validity in ISOString with nanoseconds precision and validity type EOL
  const expirationDate = new NanoDate(Date.now() + Number(lifetime))
  const validityType = IPNSEntry.ValidityType.EOL
  const validity = uint8ArrayFromString(expirationDate.toString())

  const data = encodeExtensibleData({
    ...(options?.data ?? {}),
    Value: value,
    Validity: validity,
    // @ts-expect-error should be a number
    ValidityType: 0,
    Sequence: seq,
    TTL: ttlNs
  })

  const sigData = ipnsRecordDataForV2Sig(data)
  const signatureV2 = await privateKey.sign(sigData, options)
  let record: IPNSEntry

  if (options?.v1Compatible === false) {
    record = {
      signatureV2,
      data
    }
  } else {
    record = {
      value,
      signatureV1: await signLegacyV1(privateKey, value, validityType, validity),
      validityType,
      validity,
      sequence: seq,
      ttl: ttlNs,
      signatureV2,
      data
    }
  }

  if (shouldEmbedPublicKey(privateKey.publicKey)) {
    record.publicKey = privateKey.publicKey.toProtobuf()
  }

  return record
}

/**
 * Sign ipns record data using the legacy V1 signature scheme
 */
const signLegacyV1 = async (privateKey: PrivateKey, value: Uint8Array, validityType: IPNSEntry.ValidityType, validity: Uint8Array, options?: AbortOptions): Promise<Uint8Array<ArrayBuffer>> => {
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
  return key.toMultihash().code !== IDENTITY_CODEC
}
