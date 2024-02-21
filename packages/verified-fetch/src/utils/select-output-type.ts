import { code as dagCborCode } from '@ipld/dag-cbor'
import { code as dagJsonCode } from '@ipld/dag-json'
import { code as dagPbCode } from '@ipld/dag-pb'
import { code as jsonCode } from 'multiformats/codecs/json'
import { code as rawCode } from 'multiformats/codecs/raw'
import type { RequestFormatShorthand } from '../types.js'
import type { CID } from 'multiformats/cid'

const CID_TYPE_MAP: Record<number, string[]> = {
  [dagCborCode]: [
    'application/json',
    'application/vnd.ipld.dag-cbor',
    'application/cbor',
    'application/vnd.ipld.dag-json',
    'application/octet-stream',
    'application/vnd.ipld.raw',
    'application/vnd.ipfs.ipns-record',
    'application/vnd.ipld.car'
  ],
  [dagJsonCode]: [
    'application/json',
    'application/vnd.ipld.dag-cbor',
    'application/cbor',
    'application/vnd.ipld.dag-json',
    'application/octet-stream',
    'application/vnd.ipld.raw',
    'application/vnd.ipfs.ipns-record',
    'application/vnd.ipld.car'
  ],
  [jsonCode]: [
    'application/json',
    'application/vnd.ipld.dag-cbor',
    'application/cbor',
    'application/vnd.ipld.dag-json',
    'application/octet-stream',
    'application/vnd.ipld.raw',
    'application/vnd.ipfs.ipns-record',
    'application/vnd.ipld.car'
  ],
  [dagPbCode]: [
    'application/octet-stream',
    'application/json',
    'application/vnd.ipld.dag-cbor',
    'application/cbor',
    'application/vnd.ipld.dag-json',
    'application/vnd.ipld.raw',
    'application/vnd.ipfs.ipns-record',
    'application/vnd.ipld.car',
    'application/x-tar'
  ],
  [rawCode]: [
    'application/octet-stream',
    'application/vnd.ipld.raw',
    'application/vnd.ipfs.ipns-record',
    'application/vnd.ipld.car',
    'application/x-tar'
  ]
}

/**
 * Selects an output mime-type based on the CID and a passed `Accept` header
 */
export function selectOutputType (cid: CID, accept?: string): string | undefined {
  const cidMimeTypes = CID_TYPE_MAP[cid.code]

  if (accept != null) {
    return chooseMimeType(accept, cidMimeTypes)
  }
}

function chooseMimeType (accept: string, validMimeTypes: string[]): string | undefined {
  const requestedMimeTypes = accept
    .split(',')
    .map(s => {
      const parts = s.trim().split(';')

      return {
        mimeType: `${parts[0]}`.trim(),
        weight: parseQFactor(parts[1])
      }
    })
    .sort((a, b) => {
      if (a.weight === b.weight) {
        return 0
      }

      if (a.weight > b.weight) {
        return -1
      }

      return 1
    })
    .map(s => s.mimeType)

  for (const headerFormat of requestedMimeTypes) {
    for (const mimeType of validMimeTypes) {
      if (headerFormat.includes(mimeType)) {
        return mimeType
      }

      if (headerFormat === '*/*') {
        return mimeType
      }

      if (headerFormat.startsWith('*/') && mimeType.split('/')[1] === headerFormat.split('/')[1]) {
        return mimeType
      }

      if (headerFormat.endsWith('/*') && mimeType.split('/')[0] === headerFormat.split('/')[0]) {
        return mimeType
      }
    }
  }
}

/**
 * Parses q-factor weighting from the accept header to allow letting some mime
 * types take precedence over others.
 *
 * If the q-factor for an acceptable mime representation is omitted it defaults
 * to `1`.
 *
 * All specified values should be in the range 0-1.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept#q
 */
function parseQFactor (str?: string): number {
  if (str != null) {
    str = str.trim()
  }

  if (str == null || !str.startsWith('q=')) {
    return 1
  }

  const factor = parseFloat(str.replace('q=', ''))

  if (isNaN(factor)) {
    return 0
  }

  return factor
}

const FORMAT_TO_MIME_TYPE: Record<RequestFormatShorthand, string> = {
  raw: 'application/vnd.ipld.raw',
  car: 'application/vnd.ipld.car',
  'dag-json': 'application/vnd.ipld.dag-json',
  'dag-cbor': 'application/vnd.ipld.dag-cbor',
  json: 'application/json',
  cbor: 'application/cbor',
  'ipns-record': 'application/vnd.ipfs.ipns-record',
  tar: 'application/x-tar'
}

/**
 * Converts a `format=...` query param to a mime type as would be found in the
 * `Accept` header, if a valid mapping is available
 */
export function queryFormatToAcceptHeader (format?: RequestFormatShorthand): string | undefined {
  if (format != null) {
    return FORMAT_TO_MIME_TYPE[format]
  }
}
