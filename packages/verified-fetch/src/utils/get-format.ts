import { code as dagCborCode } from '@ipld/dag-cbor'
import { code as dagJsonCode } from '@ipld/dag-json'
import type { RequestFormatShorthand } from '../types.js'
import type { CID } from 'multiformats/cid'

const FORMATS: string[] = [
  'raw', 'car', 'dag-json', 'dag-cbor', 'json', 'cbor', 'ipns-record', 'tar'
]

function isSupportedFormat (format: string): format is RequestFormatShorthand {
  return FORMATS.includes(format)
}

const FORMAT_MAP: Record<string, RequestFormatShorthand> = {
  // https://www.iana.org/assignments/media-types/application/vnd.ipld.raw
  'application/vnd.ipld.raw': 'raw',
  'application/octet-stream': 'raw',

  // https://www.iana.org/assignments/media-types/application/vnd.ipld.car
  'application/vnd.ipld.car': 'car',

  // https://www.iana.org/assignments/media-types/application/vnd.ipld.dag-json
  'application/vnd.ipld.dag-json': 'dag-json',

  // https://www.iana.org/assignments/media-types/application/vnd.ipld.dag-cbor
  'application/vnd.ipld.dag-cbor': 'dag-cbor',
  'application/json': 'json',
  'application/cbor': 'cbor',

  // https://www.iana.org/assignments/media-types/application/vnd.ipfs.ipns-record
  'application/vnd.ipfs.ipns-record': 'ipns-record',
  'application/x-tar': 'tar'
}

const MIME_TYPE_MAP: Record<RequestFormatShorthand, string> = {
  raw: 'application/octet-stream',
  car: 'application/vnd.ipld.car',
  'dag-json': 'application/vnd.ipld.dag-json',
  'dag-cbor': 'application/vnd.ipld.dag-cbor',
  json: 'application/json',
  cbor: 'application/cbor',
  'ipns-record': 'application/vnd.ipfs.ipns-record',
  tar: 'application/x-tar'
}

interface UserFormat {
  format: RequestFormatShorthand
  mimeType: string
}

/**
 * Determines the format requested by the client either by an `Accept` header or
 * a `format` query string arg.
 *
 * @see https://specs.ipfs.tech/http-gateways/path-gateway/#format-request-query-parameter
 */
export function getFormat ({ cid, headerFormat, queryFormat }: { cid: CID, headerFormat?: string | null, queryFormat?: string | null }): UserFormat | undefined {
  let output: UserFormat | undefined

  if (headerFormat != null) {
    output = getFormatFromHeader(headerFormat)
  } else if (queryFormat != null && isSupportedFormat(queryFormat)) {
    output = {
      format: queryFormat,
      mimeType: MIME_TYPE_MAP[queryFormat]
    }
  }

  // special case: if the CID is dag-json or dag-cbor but we'd use the regular
  // json handler, use the dag-json/dag-cbor one instead but retain the
  // application/json mime type - the requested mime type will be passed through
  // to the handler which will ensure the decoded object can actually be
  // represented as plain JSON
  if (output?.mimeType === 'application/json') {
    if (cid.code === dagCborCode) {
      output.format = 'dag-cbor'
    }

    if (cid.code === dagJsonCode) {
      output.format = 'dag-json'
    }
  }

  return output
}

/**
 * Match one of potentially many `Accept` header values or wildcards
 */
function getFormatFromHeader (accept: string): UserFormat | undefined {
  const headerFormats = accept
    .split(',')
    .map(s => s.split(';')[0])
    .map(s => s.trim())
    .sort()

  let foundWildcard = false

  for (const [mimeType, format] of Object.entries(FORMAT_MAP)) {
    for (const headerFormat of headerFormats) {
      if (headerFormat.includes(mimeType)) {
        return { format, mimeType }
      }

      if (headerFormat.startsWith('*/') || headerFormat.endsWith('/*')) {
        foundWildcard = true
      }
    }
  }

  if (foundWildcard) {
    return {
      format: 'raw',
      mimeType: '*/*'
    }
  }
}
