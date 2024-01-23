import { expect } from 'aegir/chai'
import { getStreamAndContentType } from '../src/utils/get-stream-and-content-type.js'

describe('getStreamAndContentType', () => {
  it('should throw an error if no content is found', async () => {
    const iterator = (async function * () { })()
    await expect(getStreamAndContentType(iterator, 'test')).to.be.rejectedWith('No content found')
  })

  it('should return the correct content type and a readable stream', async () => {
    const iterator = (async function * () { yield new TextEncoder().encode('Hello, world!') })()
    const { contentType, stream } = await getStreamAndContentType(iterator, 'test.txt')
    expect(contentType).to.equal('text/plain')
    const reader = stream.getReader()
    const { value } = await reader.read()
    expect(new TextDecoder().decode(value)).to.equal('Hello, world!')
  })

  it('should handle multiple chunks of data', async () => {
    const iterator = (async function * () { yield new TextEncoder().encode('Hello,'); yield new TextEncoder().encode(' world!') })()
    const { contentType, stream } = await getStreamAndContentType(iterator, 'test.txt')
    expect(contentType).to.equal('text/plain')
    const reader = stream.getReader()
    let result = ''
    let chunk
    while (!(chunk = await reader.read()).done) {
      result += new TextDecoder().decode(chunk.value)
    }
    expect(result).to.equal('Hello, world!')
  })
})
