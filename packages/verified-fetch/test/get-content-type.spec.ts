import { expect } from 'aegir/chai'
import { getContentType } from '../src/utils/get-content-type.js'

describe('get-content-type', () => {
  it('should return image/svg+xml for svg input', async () => {
    const input = { bytes: new TextEncoder().encode('<svg></svg>'), path: 'test.svg' }
    const output = await getContentType(input)
    expect(output).to.equal('image/svg+xml')
  })

  it('should return image/svg+xml for svg input with xml header', async () => {
    const input = { bytes: new TextEncoder().encode('<?xml version="1.0" encoding="UTF-8"?><svg></svg>'), path: 'test.svg' }
    const output = await getContentType(input)
    expect(output).to.equal('image/svg+xml')
  })

  it('should return mime type based on file path', async () => {
    const input = { bytes: new Uint8Array(), path: 'test.txt' }
    const output = await getContentType(input)
    expect(output).to.equal('text/plain')
  })

  it('should return default mime type', async () => {
    const input = { bytes: new Uint8Array(), path: 'unrecognized' }
    const output = await getContentType(input)
    expect(output).to.equal('application/octet-stream')
  })
})
