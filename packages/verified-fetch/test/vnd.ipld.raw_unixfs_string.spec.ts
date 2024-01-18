import { expect } from 'aegir/chai'
import { UnixFS } from 'ipfs-unixfs'
import drain from 'it-drain'
import { createVerifiedFetch } from '../src/index.js'
import { addContentToKuboNode } from './fixtures/add-content-to-kubo-node.js'
import { createKuboNode } from './fixtures/create-kubo.js'
import { importContentToKuboNode } from './fixtures/import-content-to-kubo-node.js'
import type { Controller } from 'ipfsd-ctl'
import type { CID } from 'multiformats/cid'

describe('vnd.ipld.raw - unixfs - string', () => {
  let controller: Controller<'go'>
  let verifiedFetch: Awaited<ReturnType<typeof createVerifiedFetch>>
  before(async () => {
    controller = await createKuboNode()
    await controller.start()

    verifiedFetch = await createVerifiedFetch({
      gateways: [`http://${controller.api.gatewayHost}:${controller.api.gatewayPort}`]
    })
  })

  after(async () => {
    await controller.stop()
    await verifiedFetch.stop()
  })

  it('Can return a raw unixfs string', async () => {
    const givenString = 'hello sgtpooki from verified-fetch test'
    const content = new UnixFS({ type: 'raw', data: (new TextEncoder()).encode(givenString) })
    const { cid } = await addContentToKuboNode(controller, content.marshal()) as { cid: CID }
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
