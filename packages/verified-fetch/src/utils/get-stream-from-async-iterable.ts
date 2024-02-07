import { CustomProgressEvent } from 'progress-events'
import type { VerifiedFetchInit } from '../index.js'
import type { ComponentLogger } from '@libp2p/interface'

/**
 * Converts an async iterator of Uint8Array bytes to a stream and returns the first chunk of bytes
 */
export async function getStreamFromAsyncIterable (iterator: AsyncIterable<Uint8Array>, path: string, logger: ComponentLogger, options?: Pick<VerifiedFetchInit, 'onProgress'>): Promise<{ stream: ReadableStream<Uint8Array>, firstChunk: Uint8Array }> {
  const log = logger.forComponent('helia:verified-fetch:get-stream-from-async-iterable')
  const reader = iterator[Symbol.asyncIterator]()
  const { value: firstChunk, done } = await reader.next()

  if (done === true) {
    log.error('No content found for path', path)
    throw new Error('No content found')
  }

  const stream = new ReadableStream({
    async start (controller) {
      // the initial value is already available
      options?.onProgress?.(new CustomProgressEvent<void>('verified-fetch:request:progress:chunk'))
      controller.enqueue(firstChunk)
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

  return {
    stream,
    firstChunk
  }
}
