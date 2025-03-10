import { UnknownError } from '../errors.js'
import type { FileCandidate } from '../index.js'

export function urlSource (url: URL | string, options?: RequestInit): FileCandidate<AsyncGenerator<Uint8Array, void, unknown>> {
  url = new URL(url)

  return {
    path: decodeURIComponent(new URL(url).pathname.split('/').pop() ?? ''),
    content: readURLContent(url, options)
  }
}

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
