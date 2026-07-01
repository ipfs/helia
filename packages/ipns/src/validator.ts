import NanoDate from 'timestamp-nano'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { InvalidEmbeddedPublicKeyError, RecordExpiredError, RecordTooLargeError, SignatureVerificationError, UnsupportedValidityError } from './errors.ts'
import { IPNSEntry } from './pb/ipns.ts'
import { decodeExtensibleData, ipnsRecordDataForV2Sig, isCodec, multihashFromIPNSRoutingKey, validateCborDataMatchesPbData } from './utils.ts'
import type { PublicKey } from '@ipshipyard/crypto'
import type { Keychain } from '@ipshipyard/keychain'
import type { AbortOptions } from '@libp2p/interface'

/**
 * Limit valid IPNS record sizes to 10kb
 */
const MAX_RECORD_SIZE = 1024 * 10

/**
 * Validate the given IPNS record against the given routing key.
 *
 * Ensure that
 * - SignatureV2 and Data are present
 * - ValidityType and Validity are of valid types and have a value
 * - CBOR data matches protobuf if it's a V1+V2 record
 *
 * @see https://specs.ipfs.tech/ipns/ipns-record/#routing-record for the binary
 * format of the routing key
 */
export async function ipnsValidator (routingKey: Uint8Array, marshalledRecord: Uint8Array, keychain: Keychain, options?: AbortOptions): Promise<IPNSEntry> {
  if (marshalledRecord.byteLength > MAX_RECORD_SIZE) {
    throw new RecordTooLargeError('The record is too large')
  }

  const record = IPNSEntry.decode(marshalledRecord)

  // Check if we have the data field. If we don't, we fail. We've been producing
  // V1+V2 records for quite a while and we don't support V1-only records during
  // validation any more
  if (record.signatureV2 == null) {
    throw new SignatureVerificationError('Missing signatureV2')
  }

  const data = decodeExtensibleData(record.data)
  const validity = uint8ArrayToString(data.Validity)

  let publicKey: PublicKey | undefined

  // try to extract public key from routing key
  const routingMultihash = multihashFromIPNSRoutingKey(routingKey)

  // identity hash
  if (isCodec(routingMultihash, 0x0)) {
    publicKey = await keychain.loadPublicKeyFromProtobuf(routingMultihash.digest, options)
  }

  // otherwise try to load key from message
  if (publicKey == null && record.publicKey != null) {
    publicKey = await keychain.loadPublicKeyFromProtobuf(record.publicKey, options)
  }

  if (publicKey == null) {
    throw new InvalidEmbeddedPublicKeyError('Could not extract public key from IPNS record or routing key')
  }

  // Validate Signature V2
  let isValid

  try {
    if (record.data == null) {
      // n.b. decodeExtensibleData would have thrown if record data was missing
      throw new Error('Missing data')
    }

    const dataForSignature = ipnsRecordDataForV2Sig(record.data)
    isValid = await publicKey.verify(dataForSignature, record.signatureV2, options)
  } catch {
    isValid = false
  }

  if (!isValid) {
    throw new SignatureVerificationError('Record signature verification failed')
  }

  // Validate according to the validity type
  if (data.ValidityType === IPNSEntry.ValidityType.EOL) {
    if (NanoDate.fromString(validity).toDate().getTime() < Date.now()) {
      throw new RecordExpiredError('record has expired')
    }
  } else if (data.ValidityType != null) {
    throw new UnsupportedValidityError(`The validity type ${data.ValidityType} is unsupported`)
  }

  if (record.value != null && record.signatureV1 != null) {
    // V1+V2
    validateCborDataMatchesPbData(record, data)
  }

  return record
}

/**
 * Returns the number of milliseconds until the record expires.
 * If the record is already expired, returns 0.
 *
 * @param record - The IPNS record to validate.
 * @returns The number of milliseconds until the record expires, or 0 if the record is already expired.
 */
export function validFor (record: IPNSEntry): number {
  const data = decodeExtensibleData(record.data)

  if (data.ValidityType !== IPNSEntry.ValidityType.EOL) {
    throw new UnsupportedValidityError()
  }

  if (data.Validity == null) {
    throw new UnsupportedValidityError()
  }

  const validUntil = NanoDate.fromString(uint8ArrayToString(data.Validity)).toDate().getTime()
  const now = Date.now()

  if (validUntil < now) {
    return 0
  }

  return validUntil - now
}
