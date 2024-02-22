import { expect } from 'aegir/chai'
import { getContentDispositionFilename } from '../../src/utils/get-content-disposition-filename.js'

describe('get-content-disposition-filename', () => {
  it('should support ascii-only filenames', () => {
    expect(
      getContentDispositionFilename('foo.txt')
    ).to.equal('filename="foo.txt"')
  })

  it('should remove non-ascii characters from filenames', () => {
    expect(
      getContentDispositionFilename('testтест.jpg')
    ).to.equal('filename="test____.jpg"; filename*=UTF-8\'\'test%D1%82%D0%B5%D1%81%D1%82.jpg')
  })
})
