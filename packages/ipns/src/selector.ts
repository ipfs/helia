import NanoDate from 'timestamp-nano'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { IPNSEntry } from './pb/ipns.ts'
import { decodeExtensibleData } from './utils.ts'

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
export function ipnsSelector (key: Uint8Array, data: IPNSEntry[]): number {
  const entries = data.map((record, index) => ({
    record,
    index
  }))

  entries.sort((a, b) => {
    // Before we'd sort based on the signature version. Validation fails if a
    // record does not have SignatureV2, so that is no longer needed. V1-only
    // records will have all expired by this point.
    const aData = decodeExtensibleData(a.record.data)
    const bData = decodeExtensibleData(b.record.data)

    const aSeq = aData.Sequence
    const bSeq = bData.Sequence

    // choose later sequence number
    if (aSeq > bSeq) {
      return -1
    } else if (aSeq < bSeq) {
      return 1
    }

    if (aData.ValidityType === IPNSEntry.ValidityType.EOL && bData.ValidityType === IPNSEntry.ValidityType.EOL) {
      // choose longer lived record if sequence numbers the same
      const recordAValidityDate = NanoDate.fromString(uint8ArrayToString(aData.Validity)).toDate()
      const recordBValidityDate = NanoDate.fromString(uint8ArrayToString(bData.Validity)).toDate()

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
