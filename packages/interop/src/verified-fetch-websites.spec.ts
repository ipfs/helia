/* eslint-env mocha */
import { createVerifiedFetch } from '@helia/verified-fetch'
import { expect } from 'aegir/chai'
import { createKuboNode } from './fixtures/create-kubo.js'
import { loadFixtureDataCar } from './fixtures/load-fixture-data.js'
import type { Controller } from 'ipfsd-ctl'

describe('@helia/verified-fetch - websites', () => {
  describe('helia-identify.on.fleek.co', () => {
    let controller: Controller<'go'>
    let verifiedFetch: Awaited<ReturnType<typeof createVerifiedFetch>>

    before(async () => {
      controller = await createKuboNode()
      await controller.start()
      // 2024-01-22 CID for _dnslink.helia-identify.on.fleek.co
      await loadFixtureDataCar(controller, 'QmbxpRxwKXxnJQjnPqm1kzDJSJ8YgkLxH23mcZURwPHjGv-helia-identify-website.car')
      verifiedFetch = await createVerifiedFetch({
        gateways: [`http://${controller.api.gatewayHost}:${controller.api.gatewayPort}`],
        // Temporarily disabling delegated routers in browser until CORS issue is fixed. see https://github.com/ipshipyard/waterworks-community/issues/4
        routers: process.env.RUNNER_ENV === 'node' ? [`http://${controller.api.gatewayHost}:${controller.api.gatewayPort}`] : []
      })
    })

    after(async () => {
      await controller.stop()
      await verifiedFetch.stop()
    })

    it('loads index.html when passed helia-identify.on.fleek.co root CID', async () => {
      const resp = await verifiedFetch('ipfs://QmbxpRxwKXxnJQjnPqm1kzDJSJ8YgkLxH23mcZURwPHjGv')
      expect(resp).to.be.ok()

      expect(resp).to.be.ok()
      const html = await resp.text()
      expect(html).to.be.ok()
      expect(html).to.include('<title>Run Identify on a remote node with Helia</title>')
    })

    it('loads helia-identify.on.fleek.co index.html directly ', async () => {
      const resp = await verifiedFetch('ipfs://QmbxpRxwKXxnJQjnPqm1kzDJSJ8YgkLxH23mcZURwPHjGv/index.html')
      expect(resp).to.be.ok()

      expect(resp).to.be.ok()
      const html = await resp.text()
      expect(html).to.be.ok()
      expect(html).to.include('<title>Run Identify on a remote node with Helia</title>')
    })
  })
})
