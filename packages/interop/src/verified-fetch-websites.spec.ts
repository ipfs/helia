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
        routers: [`http://${controller.api.gatewayHost}:${controller.api.gatewayPort}`]
      })
    })

    after(async () => {
      await controller.stop()
      await verifiedFetch.stop()
    })

    it('loads index.html when passed helia-identify.on.fleek.co root CID', async () => {
      const resp = await verifiedFetch('ipfs://QmbxpRxwKXxnJQjnPqm1kzDJSJ8YgkLxH23mcZURwPHjGv')
      expect(resp).to.be.ok()
      const html = await resp.text()
      expect(html).to.be.ok()
      expect(html).to.include('<title>Run Identify on a remote node with Helia</title>')
    })

    it('loads helia-identify.on.fleek.co index.html directly ', async () => {
      const resp = await verifiedFetch('ipfs://QmbxpRxwKXxnJQjnPqm1kzDJSJ8YgkLxH23mcZURwPHjGv/index.html')
      expect(resp).to.be.ok()
      const html = await resp.text()
      expect(html).to.be.ok()
      expect(html).to.include('<title>Run Identify on a remote node with Helia</title>')
    })
  })

  /**
   *
   * Created on 2024-01-23. /ipns/blog.libp2p.io/index.html resolved to QmVZNGy6SPvUbvQCXXaGDdp8kvfJm9MMozjU12dyzH6hKf
   *
   * ```shell
   * mkdir fake-blog.libp2p.io
   * npx kubo@0.25.0 cat '/ipfs/QmVZNGy6SPvUbvQCXXaGDdp8kvfJm9MMozjU12dyzH6hKf' > fake-blog.libp2p.io/index.html
   * npx kubo@0.25.0 add -r fake-blog.libp2p.io
   * npx kubo@0.25.0 dag export QmeiDMLtPUS3RT2xAcUwsNyZz169wPke2q7im9vZpVLSYw > QmeiDMLtPUS3RT2xAcUwsNyZz169wPke2q7im9vZpVLSYw-fake-blog.libp2p.io.car
   * ```
   */
  describe('fake blog.libp2p.io', () => {
    let controller: Controller<'go'>
    let verifiedFetch: Awaited<ReturnType<typeof createVerifiedFetch>>

    before(async () => {
      controller = await createKuboNode()
      await controller.start()
      await loadFixtureDataCar(controller, 'QmeiDMLtPUS3RT2xAcUwsNyZz169wPke2q7im9vZpVLSYw-fake-blog.libp2p.io.car')
      verifiedFetch = await createVerifiedFetch({
        gateways: [`http://${controller.api.gatewayHost}:${controller.api.gatewayPort}`],
        routers: [`http://${controller.api.gatewayHost}:${controller.api.gatewayPort}`]
      })
    })

    after(async () => {
      await controller.stop()
      await verifiedFetch.stop()
    })

    it('loads index.html when passed fake-blog.libp2p.io root CID', async () => {
      const resp = await verifiedFetch('ipfs://QmeiDMLtPUS3RT2xAcUwsNyZz169wPke2q7im9vZpVLSYw')
      expect(resp).to.be.ok()
      const html = await resp.text()
      expect(html).to.be.ok()
      expect(html).to.include('<title>Home | libp2p Blog &#x26; News</title>')
      expect(html).to.include('<link href="https://libp2p.io/" rel="canonical">')
    })
  })
})
