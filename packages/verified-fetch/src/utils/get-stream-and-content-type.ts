import { CustomProgressEvent } from 'progress-events'
import { getContentType } from './get-content-type.js'
import type { VerifiedFetchInit } from '../index.js'
import type { ComponentLogger } from '@libp2p/interface'

/**
 * Converts an async iterator of Uint8Array bytes to a stream and attempts to determine the content type of those bytes.
 */
export async function getStreamAndContentType (iterator: AsyncIterable<Uint8Array>, path: string, logger: ComponentLogger, options?: Pick<VerifiedFetchInit, 'onProgress'>): Promise<{ contentType: string, stream: ReadableStream<Uint8Array> }> {
  const log = logger.forComponent('helia:verified-fetch:get-stream-and-content-type')
  const reader = iterator[Symbol.asyncIterator]()
  const { value, done } = await reader.next()

  if (done === true) {
    log.error('No content found for path', path)
    throw new Error('No content found')
  }

  const contentType = await getContentType({ bytes: value, path })
  const stream = new ReadableStream({
    async start (controller) {
      // the initial value is already available
      options?.onProgress?.(new CustomProgressEvent<void>('verified-fetch:request:progress:chunk'))
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
