import NanoDate from 'timestamp-nano'
import { RecordExpiredError, SignatureVerificationError, UnsupportedValidityError } from './errors.ts'
import { IpnsEntry } from './pb/ipns.ts'
import { ipnsRecordDataForV2Sig } from './utils.ts'
import type { IPNSRecord } from './index.ts'
import type { AbortOptions } from '@libp2p/interface'

/**
 * Validate the given IPNS record against the given routing key.
 *
 * @see https://specs.ipfs.tech/ipns/ipns-record/#routing-record for the binary format of the routing key
 */
export async function ipnsValidator (record: IPNSRecord, options?: AbortOptions): Promise<void> {
  // Validate Signature V2
  let isValid

  try {
    const dataForSignature = ipnsRecordDataForV2Sig(record.data)
    isValid = await record.publicKey.verify(dataForSignature, record.signatureV2, options)
  } catch (err) {
    isValid = false
  }

  if (!isValid) {
    throw new SignatureVerificationError('Record signature verification failed')
  }

  // Validate according to the validity type
  if (record.validityType === IpnsEntry.ValidityType.EOL) {
    if (NanoDate.fromString(record.validity).toDate().getTime() < Date.now()) {
      throw new RecordExpiredError('record has expired')
    }
  } else if (record.validityType != null) {
    throw new UnsupportedValidityError('The validity type is unsupported')
  }
}

/**
 * Returns the number of milliseconds until the record expires.
 * If the record is already expired, returns 0.
 *
 * @param record - The IPNS record to validate.
 * @returns The number of milliseconds until the record expires, or 0 if the record is already expired.
 */
export function validFor (record: IPNSRecord): number {
  if (record.validityType !== IpnsEntry.ValidityType.EOL) {
    throw new UnsupportedValidityError()
  }

  if (record.validity == null) {
    throw new UnsupportedValidityError()
  }

  const validUntil = NanoDate.fromString(record.validity).toDate().getTime()
  const now = Date.now()

  if (validUntil < now) {
    return 0
  }

  return validUntil - now
}
