import { expect } from 'aegir/chai'
import { selectOutputType } from '../../src/utils/select-output-type.js'
import { cids } from '../fixtures/cids.js'

describe('select-output-type', () => {
  it('should return undefined if no accept header passed', () => {
    const format = selectOutputType(cids.file)

    expect(format).to.be.undefined()
  })

  it('should override query format with Accept header if available', () => {
    const format = selectOutputType(cids.file, 'application/vnd.ipld.car')

    expect(format).to.equal('application/vnd.ipld.car')
  })

  it('should match accept headers with equal weighting in definition order', () => {
    const format = selectOutputType(cids.file, 'application/x-tar, */*')

    expect(format).to.equal('application/x-tar')
  })

  it('should match accept headers in weighting order', () => {
    const format = selectOutputType(cids.file, 'application/x-tar;q=0.1, application/octet-stream;q=0.5, text/html')

    expect(format).to.equal('application/octet-stream')
  })

  it('should support partial type wildcard', () => {
    const format = selectOutputType(cids.file, '*/json')

    expect(format).to.equal('application/json')
  })

  it('should support partial subtype wildcard', () => {
    const format = selectOutputType(cids.file, 'application/*')

    expect(format).to.equal('application/octet-stream')
  })
})
