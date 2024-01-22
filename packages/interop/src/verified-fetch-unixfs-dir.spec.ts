/* eslint-env mocha */
import { createVerifiedFetch } from '@helia/verified-fetch'
import { expect } from 'aegir/chai'
import { createKuboNode } from './fixtures/create-kubo.js'
import { loadFixtureDataCar } from './fixtures/load-fixture-data.js'
import type { Controller } from 'ipfsd-ctl'

describe('@helia/verified-fetch - unixfs directory', () => {
  describe('XKCD Barrel Part 1', () => {
    let controller: Controller<'go'>
    let verifiedFetch: Awaited<ReturnType<typeof createVerifiedFetch>>

    before(async () => {
      controller = await createKuboNode()
      await controller.start()
      // This is the content of https://explore.ipld.io/#/explore/QmdmQXB2mzChmMeKY47C43LxUdg1NDJ5MWcKMKxDu7RgQm/1%20-%20Barrel%20-%20Part%201
      await loadFixtureDataCar(controller, 'QmbQDovX7wRe9ek7u6QXe9zgCXkTzoUSsTFJEkrYV1HrVR-xkcd-Barrel-part-1.car')
      verifiedFetch = await createVerifiedFetch({
        gateways: [`http://${controller.api.gatewayHost}:${controller.api.gatewayPort}`],
        routers: [`http://${controller.api.gatewayHost}:${controller.api.gatewayPort}`]
      })
    })

    after(async () => {
      await controller.stop()
      await verifiedFetch.stop()
    })

    it('fails to load when passed the root', async () => {
      // The spec says we should generate HTML with directory listings, but we don't do that yet, so expect a failure
      const resp = await verifiedFetch('ipfs://QmbQDovX7wRe9ek7u6QXe9zgCXkTzoUSsTFJEkrYV1HrVR')
      expect(resp).to.be.ok()
      expect(resp.status).to.equal(501) // TODO: we should do a directory listing instead
    })

    it('Can return a string for unixfs pathed data', async () => {
      const resp = await verifiedFetch('ipfs://QmbQDovX7wRe9ek7u6QXe9zgCXkTzoUSsTFJEkrYV1HrVR/1 - Barrel - Part 1 - alt.txt')
      expect(resp).to.be.ok()
      const text = await resp.text()
      expect(text).to.equal('Don\'t we all.')
      expect(resp.headers.get('content-type')).to.equal('text/plain')
    })

    it('Can return an image for unixfs pathed data', async () => {
      const resp = await verifiedFetch('ipfs://QmbQDovX7wRe9ek7u6QXe9zgCXkTzoUSsTFJEkrYV1HrVR/1 - Barrel - Part 1.png')
      expect(resp).to.be.ok()
      expect(resp.headers.get('content-type')).to.equal('image/png')
      const imgData = await resp.blob()
      expect(imgData).to.be.ok()
      expect(imgData.size).to.equal(24848)
    })
  })
})
