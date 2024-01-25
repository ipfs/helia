import { logger } from '@libp2p/logger'
import { CustomProgressEvent } from 'progress-events'
import { getContentType } from './get-content-type.js'
import type { VerifiedFetchOptions } from '../interface.js'

const log = logger('helia:verified-fetch:get-stream-and-content-type')

/**
 * Converts an async iterator of Uint8Array bytes to a stream and attempts to determine the content type of those bytes.
 */
export async function getStreamAndContentType (iterator: AsyncIterable<Uint8Array>, path: string, options?: Pick<VerifiedFetchOptions, 'onProgress'>): Promise<{ contentType: string, stream: ReadableStream<Uint8Array> }> {
  const reader = iterator[Symbol.asyncIterator]()
  const { value, done } = await reader.next()
  options?.onProgress?.(new CustomProgressEvent<void>('verified-fetch:request:progress:chunk'))
  if (done === true) {
    log.error('No content found')
    throw new Error('No content found')
  }

  const contentType = await getContentType({ bytes: value, path })
  const stream = new ReadableStream({
    async start (controller) {
      // the initial value is already available
      controller.enqueue(value)
    },
    async pull (controller) {
      const { value, done } = await reader.next()
      if (done === true) {
        if (value != null) {
          options?.onProgress?.(new CustomProgressEvent<void>('verified-fetch:request:progress:chunk'))
          controller.enqueue(value)
        }
        controller.close()
        return
      }
      options?.onProgress?.(new CustomProgressEvent<void>('verified-fetch:request:progress:chunk'))
      controller.enqueue(value)
    }
  })

  return { contentType, stream }
}
