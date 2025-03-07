import { UnknownError } from '../errors.js'
import type { FileCandidate } from 'ipfs-unixfs-importer'

export interface URLSourceOptions extends RequestInit {
  /**
   * By default the path segment of a URL is included in the FileCandidate as
   * the path, pass `false` here to ignore it.
   *
   * @default {true}
   */
  ignorePath?: boolean
}

export function urlSource (url: URL | string, options?: URLSourceOptions): FileCandidate<AsyncGenerator<Uint8Array, void, unknown>> {
  url = new URL(url)

  return {
    path: options?.ignorePath === true ? undefined : decodeURIComponent(new URL(url).pathname.split('/').pop() ?? ''),
    content: readURLContent(url, options)
  }
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
