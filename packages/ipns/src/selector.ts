import NanoDate from 'timestamp-nano'
import { IpnsEntry } from './pb/ipns.ts'
import type { IPNSRecord } from './records.ts'

/**
 * Selects the latest valid IPNS record from an array of marshalled IPNS records.
 *
 * Records are sorted by:
 * 1. Sequence number (higher takes precedence)
 * 2. Validity time for EOL records with same sequence number (longer lived record takes precedence)
 *
 * @param key - The routing key for the IPNS record
 * @param data - Array of marshalled IPNS records to select from
 * @returns The index of the most valid record from the input array
 */
export function ipnsSelector (key: Uint8Array, data: IPNSRecord[]): number {
  const entries = data.map((record, index) => ({
    record,
    index
  }))

  entries.sort((a, b) => {
    // Before we'd sort based on the signature version. Unmarshal now fails if
    // a record does not have SignatureV2, so that is no longer needed. V1-only
    // records haven't been issues in a long time.

    const aSeq = a.record.sequence
    const bSeq = b.record.sequence

    // choose later sequence number
    if (aSeq > bSeq) {
      return -1
    } else if (aSeq < bSeq) {
      return 1
    }

    if (a.record.validityType === IpnsEntry.ValidityType.EOL && b.record.validityType === IpnsEntry.ValidityType.EOL) {
      // choose longer lived record if sequence numbers the same
      const recordAValidityDate = NanoDate.fromString(a.record.validity).toDate()
      const recordBValidityDate = NanoDate.fromString(b.record.validity).toDate()

      if (recordAValidityDate.getTime() > recordBValidityDate.getTime()) {
        return -1
      }

      if (recordAValidityDate.getTime() < recordBValidityDate.getTime()) {
        return 1
      }
    }

    return 0
  })

  return entries[0].index
}
