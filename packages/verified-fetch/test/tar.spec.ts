import { unixfs } from '@helia/unixfs'
import { stop } from '@libp2p/interface'
import { expect } from 'aegir/chai'
import browserReadableStreamToIt from 'browser-readablestream-to-it'
import all from 'it-all'
import last from 'it-last'
import { pipe } from 'it-pipe'
import { extract } from 'it-tar'
import toBuffer from 'it-to-buffer'
import { VerifiedFetch } from '../src/verified-fetch.js'
import { createHelia } from './fixtures/create-offline-helia.js'
import type { Helia } from '@helia/interface'
import type { FileCandidate } from 'ipfs-unixfs-importer'

describe('tar files', () => {
  let helia: Helia
  let verifiedFetch: VerifiedFetch

  beforeEach(async () => {
    helia = await createHelia()
    verifiedFetch = new VerifiedFetch({
      helia
    })
  })

  afterEach(async () => {
    await stop(helia, verifiedFetch)
  })

  it('should support fetching a TAR file', async () => {
    const file = Uint8Array.from([0, 1, 2, 3, 4])
    const fs = unixfs(helia)
    const cid = await fs.addBytes(file)

    const resp = await verifiedFetch.fetch(cid, {
      headers: {
        accept: 'application/x-tar'
      }
    })
    expect(resp.status).to.equal(200)
    expect(resp.headers.get('content-type')).to.equal('application/x-tar')
    expect(resp.headers.get('content-disposition')).to.equal(`attachment; filename="${cid.toString()}.tar"`)

    if (resp.body == null) {
      throw new Error('Download failed')
    }

    const entries = await pipe(
      browserReadableStreamToIt(resp.body),
      extract(),
      async source => all(source)
    )

    expect(entries).to.have.lengthOf(1)
    await expect(toBuffer(entries[0].body)).to.eventually.deep.equal(file)
  })

  it('should support fetching a TAR file containing a directory', async () => {
    const directory: FileCandidate[] = [{
      path: 'foo.txt',
      content: Uint8Array.from([0, 1, 2, 3, 4])
    }, {
      path: 'bar.txt',
      content: Uint8Array.from([5, 6, 7, 8, 9])
    }, {
      path: 'baz/qux.txt',
      content: Uint8Array.from([1, 2, 3, 4, 5])
    }]

    const fs = unixfs(helia)
    const importResult = await last(fs.addAll(directory, {
      wrapWithDirectory: true
    }))

    if (importResult == null) {
      throw new Error('Import failed')
    }

    const resp = await verifiedFetch.fetch(importResult.cid, {
      headers: {
        accept: 'application/x-tar'
      }
    })
    expect(resp.status).to.equal(200)
    expect(resp.headers.get('content-type')).to.equal('application/x-tar')
    expect(resp.headers.get('content-disposition')).to.equal(`attachment; filename="${importResult.cid.toString()}.tar"`)

    if (resp.body == null) {
      throw new Error('Download failed')
    }

    const entries = await pipe(
      browserReadableStreamToIt(resp.body),
      extract(),
      async source => all(source)
    )

    expect(entries).to.have.lengthOf(5)
    expect(entries[0]).to.have.nested.property('header.name', importResult.cid.toString())

    expect(entries[1]).to.have.nested.property('header.name', `${importResult.cid}/${directory[1].path}`)
    await expect(toBuffer(entries[1].body)).to.eventually.deep.equal(directory[1].content)

    expect(entries[2]).to.have.nested.property('header.name', `${importResult.cid}/${directory[2].path?.split('/')[0]}`)

    expect(entries[3]).to.have.nested.property('header.name', `${importResult.cid}/${directory[2].path}`)
    await expect(toBuffer(entries[3].body)).to.eventually.deep.equal(directory[2].content)

    expect(entries[4]).to.have.nested.property('header.name', `${importResult.cid}/${directory[0].path}`)
    await expect(toBuffer(entries[4].body)).to.eventually.deep.equal(directory[0].content)
  })

  it('should support fetching a TAR file by format', async () => {
    const file = Uint8Array.from([0, 1, 2, 3, 4])
    const fs = unixfs(helia)
    const cid = await fs.addBytes(file)

    const resp = await verifiedFetch.fetch(`ipfs://${cid}?format=tar`)
    expect(resp.status).to.equal(200)
    expect(resp.headers.get('content-type')).to.equal('application/x-tar')
    expect(resp.headers.get('content-disposition')).to.equal(`attachment; filename="${cid.toString()}.tar"`)
  })

  it('should support specifying a filename for a TAR file', async () => {
    const file = Uint8Array.from([0, 1, 2, 3, 4])
    const fs = unixfs(helia)
    const cid = await fs.addBytes(file)

    const resp = await verifiedFetch.fetch(`ipfs://${cid}?filename=foo.bar`, {
      headers: {
        accept: 'application/x-tar'
      }
    })
    expect(resp.status).to.equal(200)
    expect(resp.headers.get('content-type')).to.equal('application/x-tar')
    expect(resp.headers.get('content-disposition')).to.equal('attachment; filename="foo.bar"')
  })

  it('should support fetching a TAR file by format with a filename', async () => {
    const file = Uint8Array.from([0, 1, 2, 3, 4])
    const fs = unixfs(helia)
    const cid = await fs.addBytes(file)

    const resp = await verifiedFetch.fetch(`ipfs://${cid}?format=tar&filename=foo.bar`)
    expect(resp.status).to.equal(200)
    expect(resp.headers.get('content-type')).to.equal('application/x-tar')
    expect(resp.headers.get('content-disposition')).to.equal('attachment; filename="foo.bar"')
  })
})
