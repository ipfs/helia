import { expect } from 'aegir/chai'
import all from 'it-all'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { urlSource } from '../../src/utils/url-source.js'

describe('url-source', function () {
  it('can get url content', async function () {
    const content = 'foo'
    const file = urlSource(new URL(`${process.env.ECHO_SERVER}/download?data=${content}`))

    expect(file).to.have.property('path', 'download')

    if (file.content != null) {
      await expect(all(file.content)).to.eventually.deep.equal([uint8ArrayFromString(content)])
    } else {
      throw new Error('empty response')
    }
  })
})
