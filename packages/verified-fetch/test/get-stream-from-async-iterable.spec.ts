import { defaultLogger } from '@libp2p/logger'
import { expect } from 'aegir/chai'
import sinon from 'sinon'
import { getStreamFromAsyncIterable } from '../src/utils/get-stream-from-async-iterable.js'

describe('getStreamFromAsyncIterable', () => {
  let onProgressSpy: sinon.SinonSpy

  beforeEach(() => {
    onProgressSpy = sinon.spy()
  })

  it('should throw an error if no content is found', async () => {
    const iterator = (async function * () { })()
    await expect(getStreamFromAsyncIterable(iterator, 'test', defaultLogger())).to.be.rejectedWith('No content found')
  })

  it('should return the correct content type and a readable stream', async () => {
    const chunks = new TextEncoder().encode('Hello, world!')
    const iterator = (async function * () { yield chunks })()
    const { firstChunk, stream } = await getStreamFromAsyncIterable(iterator, 'test.txt', defaultLogger(), { onProgress: onProgressSpy })
    expect(firstChunk).to.equal(chunks)
    const reader = stream.getReader()
    const { value } = await reader.read()
    expect(onProgressSpy.callCount).to.equal(1)
    expect(new TextDecoder().decode(value)).to.equal('Hello, world!')
  })

  it('should handle multiple chunks of data', async () => {
    const textEncoder = new TextEncoder()
    const chunks = ['Hello,', ' world!'].map((txt) => textEncoder.encode(txt))
    const iterator = (async function * () { yield chunks[0]; yield chunks[1] })()
    const { firstChunk, stream } = await getStreamFromAsyncIterable(iterator, 'test.txt', defaultLogger(), { onProgress: onProgressSpy })
    expect(firstChunk).to.equal(chunks[0])
    const reader = stream.getReader()
    let result = ''
    let chunk
    while (!(chunk = await reader.read()).done) {
      result += new TextDecoder().decode(chunk.value)
    }
    expect(onProgressSpy.callCount).to.equal(2)
    expect(result).to.equal('Hello, world!')
  })

  it('should include last value done is true', async () => {
    // if done === true and there is a value
    const LIMIT = 5
    let actualFirstChunk: Uint8Array
    const iterator: AsyncIterable<Uint8Array> = {
      [Symbol.asyncIterator] () {
        let i = 0
        return {
          async next () {
            const done = i === LIMIT
            const value = new Uint8Array([i++])
            actualFirstChunk = actualFirstChunk ?? value
            return Promise.resolve({ value, done })
          }
        }
      }
    }
    const { firstChunk, stream } = await getStreamFromAsyncIterable(iterator, 'test.txt', defaultLogger(), { onProgress: onProgressSpy })
    // @ts-expect-error - actualFirstChunk is not used before set, because the await above.
    expect(firstChunk).to.equal(actualFirstChunk)
    const reader = stream.getReader()
    const result = []
    let chunk
    while (!(chunk = await reader.read()).done) {
      result.push(...chunk.value)
    }
    expect(onProgressSpy.callCount).to.equal(6)
    expect(result).to.deep.equal([...Array(LIMIT + 1).keys()])
  })
})
