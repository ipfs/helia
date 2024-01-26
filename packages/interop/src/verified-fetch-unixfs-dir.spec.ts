/* eslint-env mocha */
import { createVerifiedFetch } from '@helia/verified-fetch'
import { expect } from 'aegir/chai'
import { createKuboNode } from './fixtures/create-kubo.js'
import { loadFixtureDataCar } from './fixtures/load-fixture-data.js'
import type { Controller } from 'ipfsd-ctl'

describe('@helia/verified-fetch - unixfs directory', () => {
  let controller: Controller
  let verifiedFetch: Awaited<ReturnType<typeof createVerifiedFetch>>

  before(async () => {
    controller = await createKuboNode()
    await controller.start()
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

  describe('XKCD Barrel Part 1', () => {
    before(async () => {
      // This is the content of https://explore.ipld.io/#/explore/QmdmQXB2mzChmMeKY47C43LxUdg1NDJ5MWcKMKxDu7RgQm/1%20-%20Barrel%20-%20Part%201
      await loadFixtureDataCar(controller, 'QmbQDovX7wRe9ek7u6QXe9zgCXkTzoUSsTFJEkrYV1HrVR-xkcd-Barrel-part-1.car')
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

  // TODO: find a smaller car file so the test doesn't timeout locally or flake on CI
  describe.skip('HAMT-sharded directory', () => {
    before(async () => {
      // from https://github.com/ipfs/gateway-conformance/blob/193833b91f2e9b17daf45c84afaeeae61d9d7c7e/fixtures/trustless_gateway_car/single-layer-hamt-with-multi-block-files.car
      await loadFixtureDataCar(controller, 'bafybeidbclfqleg2uojchspzd4bob56dqetqjsj27gy2cq3klkkgxtpn4i-single-layer-hamt-with-multi-block-files.car')
    })

    it('loads path /ipfs/bafybeidbclfqleg2uojchspzd4bob56dqetqjsj27gy2cq3klkkgxtpn4i/685.txt', async () => {
      const resp = await verifiedFetch('ipfs://bafybeidbclfqleg2uojchspzd4bob56dqetqjsj27gy2cq3klkkgxtpn4i/685.txt')
      expect(resp).to.be.ok()
      expect(resp.headers.get('content-type')).to.equal('text/plain')
      const text = await resp.text()
      // npx kubo@0.25.0 cat '/ipfs/bafybeidbclfqleg2uojchspzd4bob56dqetqjsj27gy2cq3klkkgxtpn4i/685.txt'
      expect(text).to.equal(`Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc non imperdiet nunc. Proin ac quam ut nibh eleifend aliquet. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Sed ligula dolor, imperdiet sagittis arcu et, semper tincidunt urna. Donec et tempor augue, quis sollicitudin metus. Curabitur semper ullamcorper aliquet. Mauris hendrerit sodales lectus eget fermentum. Proin sollicitudin vestibulum commodo. Vivamus nec lectus eu augue aliquet dignissim nec condimentum justo. In hac habitasse platea dictumst. Mauris vel sem neque.

Vivamus finibus, enim at lacinia semper, arcu erat gravida lacus, sit amet gravida magna orci sit amet est. Sed non leo lacus. Nullam viverra ipsum a tincidunt dapibus. Nulla pulvinar ligula sit amet ante ultrices tempus. Proin purus urna, semper sed lobortis quis, gravida vitae ipsum. Aliquam mi urna, pulvinar eu bibendum quis, convallis ac dolor. In gravida justo sed risus ullamcorper, vitae luctus massa hendrerit. Pellentesque habitant amet.`)
    })
  })
})
