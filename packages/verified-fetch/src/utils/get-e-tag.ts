import type { RequestFormatShorthand } from '../types.js'
import type { CID } from 'multiformats/cid'

interface GetETagArg {
  cid: CID
  reqFormat?: RequestFormatShorthand
  rangeStart?: number
  rangeEnd?: number
  /**
   * Weak Etag is used when we can't guarantee byte-for-byte-determinism (generated, or mutable content).
   * Some examples:
   * - IPNS requests
   * - CAR streamed with blocks in non-deterministic order
   * - TAR streamed with files in non-deterministic order
   */
  weak?: boolean
}

/**
 * etag
 * you need to wrap cid  with ""
 * we use strong Etags for immutable responses and weak one (prefixed with W/ ) for mutable/generated ones (ipns and generated HTML).
 * block and car responses should have different etag than deserialized one, so you can add some prefix like we do in existing gateway
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag
 * @see https://specs.ipfs.tech/http-gateways/path-gateway/#etag-response-header
 */
export function getETag ({ cid, reqFormat, weak, rangeStart, rangeEnd }: GetETagArg): string {
  const prefix = weak === true ? 'W/' : ''
  let suffix = reqFormat == null ? '' : `.${reqFormat}`
  if (rangeStart != null || rangeEnd != null) {
    suffix += `.${rangeStart ?? '0'}-${rangeEnd ?? 'N'}`
  }

  return `${prefix}"${cid.toString()}${suffix}"`
}
