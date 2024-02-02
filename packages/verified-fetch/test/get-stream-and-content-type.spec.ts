import { defaultLogger } from '@libp2p/logger'
import { expect } from 'aegir/chai'
import sinon from 'sinon'
import { getStreamAndContentType } from '../src/utils/get-stream-and-content-type.js'

describe('getStreamAndContentType', () => {
  let onProgressSpy: sinon.SinonSpy

  beforeEach(() => {
    onProgressSpy = sinon.spy()
  })

  it('should throw an error if no content is found', async () => {
    const iterator = (async function * () { })()
    await expect(getStreamAndContentType(iterator, 'test', defaultLogger())).to.be.rejectedWith('No content found')
  })

  it('should return the correct content type and a readable stream', async () => {
    const iterator = (async function * () { yield new TextEncoder().encode('Hello, world!') })()
    const { contentType, stream } = await getStreamAndContentType(iterator, 'test.txt', defaultLogger(), { onProgress: onProgressSpy })
    expect(contentType).to.equal('text/plain')
    const reader = stream.getReader()
    const { value } = await reader.read()
    expect(onProgressSpy.callCount).to.equal(1)
    expect(new TextDecoder().decode(value)).to.equal('Hello, world!')
  })

  it('should handle multiple chunks of data', async () => {
    const iterator = (async function * () { yield new TextEncoder().encode('Hello,'); yield new TextEncoder().encode(' world!') })()
    const { contentType, stream } = await getStreamAndContentType(iterator, 'test.txt', defaultLogger(), { onProgress: onProgressSpy })
    expect(contentType).to.equal('text/plain')
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
    const iterator: AsyncIterable<Uint8Array> = {
      [Symbol.asyncIterator] () {
        let i = 0
        return {
          async next () {
            const done = i === LIMIT
            const value = new Uint8Array([i++])
            return Promise.resolve({ value, done })
          }
        }
      }
    }
    const { contentType, stream } = await getStreamAndContentType(iterator, 'test.txt', defaultLogger(), { onProgress: onProgressSpy })
    expect(contentType).to.equal('text/plain')
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
