import { createHeliaHTTP } from '@helia/http'
import { unixfs } from '@helia/unixfs'
import { stop } from '@libp2p/interface'
import { fileTypeFromBuffer } from '@sgtpooki/file-type'
import { expect } from 'aegir/chai'
import { filetypemime } from 'magic-bytes.js'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
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

  it('does not set content type if contentTypeParser is not passed', async () => {
    verifiedFetch = new VerifiedFetch({
      helia
    })
    const resp = await verifiedFetch.fetch(cid)
    expect(resp.headers.get('content-type')).to.equal('application/octet-stream')
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
