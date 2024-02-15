import { expect } from 'aegir/chai'
import { getFormat } from '../../src/utils/get-format.js'
import { cids } from '../fixtures/cids.js'

describe('get-format', () => {
  it('should override query format with Accept header if available', () => {
    const format = getFormat({
      cid: cids.file,
      headerFormat: 'application/vnd.ipld.car',
      queryFormat: 'raw'
    })

    expect(format).to.have.property('format', 'car')
    expect(format).to.have.property('mimeType', 'application/vnd.ipld.car')
  })

  it('should default wildcards to raw format', () => {
    const format = getFormat({
      cid: cids.file,
      headerFormat: '*/*'
    })

    expect(format).to.have.property('format', 'raw')
    expect(format).to.have.property('mimeType', '*/*')
  })

  it('should use specific type before wildcard', () => {
    const format = getFormat({
      cid: cids.file,
      headerFormat: '*/*, application/x-tar'
    })

    expect(format).to.have.property('format', 'tar')
    expect(format).to.have.property('mimeType', 'application/x-tar')
  })

  it('should use specific type before wildcard', () => {
    const format = getFormat({
      cid: cids.file,
      headerFormat: 'application/x-tar, */*'
    })

    expect(format).to.have.property('format', 'tar')
    expect(format).to.have.property('mimeType', 'application/x-tar')
  })

  it('should support partial wildcard', () => {
    const format = getFormat({
      cid: cids.file,
      headerFormat: 'application/*'
    })

    expect(format).to.have.property('format', 'raw')
    expect(format).to.have.property('mimeType', '*/*')
  })

  it('should support partial wildcard', () => {
    const format = getFormat({
      cid: cids.file,
      headerFormat: '*/'
    })

    expect(format).to.have.property('format', 'raw')
    expect(format).to.have.property('mimeType', '*/*')
  })
})
