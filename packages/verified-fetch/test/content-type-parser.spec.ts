import { createHeliaHTTP } from '@helia/http'
import { unixfs } from '@helia/unixfs'
import { stop } from '@libp2p/interface'
import { fileTypeFromBuffer } from '@sgtpooki/file-type'
import { expect } from 'aegir/chai'
import { filetypemime } from 'magic-bytes.js'
import Sinon from 'sinon'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { createVerifiedFetch } from '../src/index.js'
import { VerifiedFetch } from '../src/verified-fetch.js'
import type { Helia } from '@helia/interface'
import type { CID } from 'multiformats/cid'

describe('content-type-parser', () => {
  let helia: Helia
  let cid: CID
  let verifiedFetch: VerifiedFetch

  beforeEach(async () => {
    helia = await createHeliaHTTP()
    const fs = unixfs(helia)
    cid = await fs.addByteStream((async function * () {
      yield uint8ArrayFromString('H4sICIlTHVIACw', 'base64')
    })())
  })

  afterEach(async () => {
    await stop(verifiedFetch)
  })

  it('is used when passed to createVerifiedFetch', async () => {
    const contentTypeParser = Sinon.stub().resolves('text/plain')
    const fetch = await createVerifiedFetch(helia, {
      contentTypeParser
    })
    expect(fetch).to.be.ok()
    const resp = await fetch(cid)
    expect(resp.headers.get('content-type')).to.equal('text/plain')
    await fetch.stop()
  })

  it('sets default content type if contentTypeParser is not passed', async () => {
    verifiedFetch = new VerifiedFetch({
      helia
    })
    const resp = await verifiedFetch.fetch(cid)
    expect(resp.headers.get('content-type')).to.equal('application/octet-stream')
  })

  it('sets default content type if contentTypeParser returns undefined', async () => {
    verifiedFetch = new VerifiedFetch({
      helia
    }, {
      contentTypeParser: () => undefined
    })
    const resp = await verifiedFetch.fetch(cid)
    expect(resp.headers.get('content-type')).to.equal('application/octet-stream')
  })

  it('sets default content type if contentTypeParser returns promise of undefined', async () => {
    verifiedFetch = new VerifiedFetch({
      helia
    }, {
      contentTypeParser: async () => undefined
    })
    const resp = await verifiedFetch.fetch(cid)
    expect(resp.headers.get('content-type')).to.equal('application/octet-stream')
  })

  it('is passed a filename if it is available', async () => {
    const fs = unixfs(helia)
    const dir = await fs.addDirectory()
    const index = await fs.addBytes(uint8ArrayFromString('<html><body>Hello world</body></html>'))
    const dirCid = await fs.cp(index, dir, 'index.html')

    verifiedFetch = new VerifiedFetch({
      helia
    }, {
      contentTypeParser: async (data, fileName) => fileName
    })
    const resp = await verifiedFetch.fetch(`ipfs://${dirCid}/index.html`)
    expect(resp.headers.get('content-type')).to.equal('index.html')
  })

  it('is passed a filename from a deep traversal if it is available', async () => {
    const fs = unixfs(helia)
    const deepDirCid = await fs.addFile({
      path: 'foo/bar/a-file.html',
      content: uint8ArrayFromString('<html><body>Hello world</body></html>')
    })

    verifiedFetch = new VerifiedFetch({
      helia
    }, {
      contentTypeParser: async (data, fileName) => fileName
    })
    const resp = await verifiedFetch.fetch(`ipfs://${deepDirCid}/foo/bar/a-file.html`)
    expect(resp.headers.get('content-type')).to.equal('a-file.html')
  })

  it('sets content type if contentTypeParser is passed', async () => {
    verifiedFetch = new VerifiedFetch({
      helia
    }, {
      contentTypeParser: () => 'text/plain'
    })
    const resp = await verifiedFetch.fetch(cid)
    expect(resp.headers.get('content-type')).to.equal('text/plain')
  })

  it('supports @sgtpooki/file-type as a contentTypeParser', async () => {
    verifiedFetch = new VerifiedFetch({
      helia
    }, {
      contentTypeParser: async (bytes) => {
        const type = await fileTypeFromBuffer(bytes)
        return type?.mime
      }
    })
    const resp = await verifiedFetch.fetch(cid)
    expect(resp.headers.get('content-type')).to.equal('application/gzip')
  })

  it('supports magic-bytes.js as a contentTypeParser', async () => {
    verifiedFetch = new VerifiedFetch({
      helia
    }, {
      contentTypeParser: (bytes) => {
        return filetypemime(bytes)?.[0]
      }
    })
    const resp = await verifiedFetch.fetch(cid)
    expect(resp.headers.get('content-type')).to.equal('application/gzip')
  })
})
