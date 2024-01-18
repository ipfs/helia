import { expect } from 'aegir/chai'
import { UnixFS } from 'ipfs-unixfs'
import { createVerifiedFetch } from '../src/index.js'
import { addContentToKuboNode } from './fixtures/add-content-to-kubo-node.js'
import { createKuboNode } from './fixtures/create-kubo.js'
import type { Controller } from 'ipfsd-ctl'
import type { CID } from 'multiformats/cid'

describe('vnd.ipld.raw - unixfs - string', () => {
  let controller: Controller<'go'>
  beforeEach(async () => {
    controller = await createKuboNode()
    await controller.start()
  })

  afterEach(async () => {
    await controller.stop()
  })

  it('Can return a raw unixfs string', async () => {
    const verifiedFetch = await createVerifiedFetch({
      gateways: [`http://${controller.api.gatewayHost}:${controller.api.gatewayPort}`]
    })
    const givenString = 'hello sgtpooki from verified-fetch test'
    const content = new UnixFS({ type: 'raw', data: (new TextEncoder()).encode(givenString) })
    const { cid } = await addContentToKuboNode(controller, content.marshal()) as { cid: CID }
    expect(cid).to.be.ok()
    const resp = await verifiedFetch(cid)
    expect(resp).to.be.ok()
    const text = await resp.text()
    expect(text).to.equal(givenString)
    await verifiedFetch.stop()
  })
})
