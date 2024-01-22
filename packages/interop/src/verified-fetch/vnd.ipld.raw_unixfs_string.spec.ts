import { unixfs } from '@helia/unixfs'
import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { UnixFS } from 'ipfs-unixfs'
import all from 'it-all'
import drain from 'it-drain'
import { createVerifiedFetch } from '../../../verified-fetch/src/index.js'
import { addContentToKuboNode } from '../../../verified-fetch/test/fixtures/add-content-to-kubo-node.js'
import { createKuboNode } from '../../../verified-fetch/test/fixtures/create-kubo.js'
import { importContentToKuboNode } from '../../../verified-fetch/test/fixtures/import-content-to-kubo-node.js'
import type { Controller } from 'ipfsd-ctl'
import type { CID } from 'multiformats/cid'

describe.skip('vnd.ipld.raw - unixfs - string', () => {
  let controller: Controller<'go'>
  let verifiedFetch: Awaited<ReturnType<typeof createVerifiedFetch>>
  beforeEach(async () => {
    controller = await createKuboNode()
    await controller.start()

    verifiedFetch = await createVerifiedFetch({
      gateways: [`http://${controller.api.gatewayHost}:${controller.api.gatewayPort}`]
    })
  })

  afterEach(async () => {
    await controller.stop()
    await verifiedFetch.stop()
  })

  it('Can return a raw unixfs string', async () => {
    const givenString = 'hello sgtpooki from verified-fetch test'
    const content = new UnixFS({ type: 'file', data: (new TextEncoder()).encode(givenString) })
    const { cid } = await controller.api.add(content.marshal(), {
      cidVersion: 1,
      pin: false
    }) as { cid: CID }
    expect(cid).to.be.ok()
    const resp = await verifiedFetch(cid)
    expect(resp).to.be.ok()
    const text = await resp.text()
    expect(text).to.equal(givenString)
  })

  // eslint-disable-next-line no-only-tests/no-only-tests
  it('can handle helia/unixfs file with string content', async () => {
    const givenString = 'hello sgtpooki from verified-fetch test2'
    const fs = unixfs({ blockstore: new MemoryBlockstore() })
    const fileCid = await fs.addBytes((new TextEncoder()).encode(givenString))
    const fileContent = await all(fs.cat(fileCid))
    const { cid } = await controller.api.add(fileContent, {
      cidVersion: 1,
      pin: false
    }) as { cid: CID }
    expect(cid).to.be.ok()
    const resp = await verifiedFetch(cid)
    expect(resp).to.be.ok()
    const text = await resp.text()
    expect(text).to.equal(givenString)
  })

  it('Can return a string for unixfs pathed data', async () => {
    const ipfsUrl = 'ipfs://QmdmQXB2mzChmMeKY47C43LxUdg1NDJ5MWcKMKxDu7RgQm/1 - Barrel - Part 1/1 - Barrel - Part 1 - alt.txt'
    await drain(await importContentToKuboNode(controller, '/ipfs/QmdmQXB2mzChmMeKY47C43LxUdg1NDJ5MWcKMKxDu7RgQm/1 - Barrel - Part 1/1 - Barrel - Part 1 - alt.txt'))
    const resp = await verifiedFetch(ipfsUrl)
    expect(resp).to.be.ok()
    const text = await resp.text()
    expect(text).to.equal('Don\'t we all.')
  })
})
