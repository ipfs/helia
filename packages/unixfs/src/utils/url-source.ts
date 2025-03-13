import { UnknownError } from '../errors.js'
import type { FileCandidate } from '../index.js'

/**
 * Import a file directly from a URL. The path of the file will be the path
 * section of the URL.
 *
 * @example
 *
 * ```ts
 * import { unixfs, urlSource } from '@helia/unixfs'
 * import { createHelia } from 'helia'
 *
 * const helia = await createHelia()
 * const fs = unixfs(helia)
 *
 * const cid = await fs.addFile(urlSource('http://example.com/path/to/file.html))
 * const stat = await fs.stat(cid)
 *
 * console.info(stat)
 * // { cid: CID(...), type: 'directory', ... }
 *
 * for await (const entry of fs.ls(cid)) {
 *   console.info(entry)
 *   // { type: 'file', name: 'file.html', cid: CID(...), ... }
 * }
 * ```
 */
export function urlSource (url: URL | string, options?: RequestInit): FileCandidate<AsyncGenerator<Uint8Array, void, unknown>> {
  url = new URL(url)

  return {
    path: decodeURIComponent(new URL(url).pathname.split('/').pop() ?? ''),
    content: readURLContent(url, options)
  }
}

/**
 * Import a file directly from a URL ignoring the file name or any containing
 * directory.
 *
 * @example
 *
 * ```ts
 * import { unixfs, urlByteSource } from '@helia/unixfs'
 * import { createHelia } from 'helia'
 *
 * const helia = await createHelia()
 * const fs = unixfs(helia)
 *
 * const cid = await fs.addByteSource(urlByteSource('http://example.com/path/to/file.html))
 * const stat = await fs.stat(cid)
 *
 * console.info(stat)
 * // { type: 'file', cid: CID(...), ... }
 * ```
 */
export function urlByteSource (url: URL | string, options?: RequestInit): AsyncGenerator<Uint8Array, void, unknown> {
  url = new URL(url)

  return readURLContent(url, options)
}

async function * readURLContent (url: URL, options?: RequestInit): AsyncGenerator<Uint8Array, void, unknown> {
  const response = await globalThis.fetch(url, options)

  if (response.body == null) {
    throw new UnknownError('HTTP response did not have a body')
  }

  const reader = response.body.getReader()

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        return
      }

      if (value != null) {
        yield value
      }
    }
  } finally {
    reader.releaseLock()
  }
}
