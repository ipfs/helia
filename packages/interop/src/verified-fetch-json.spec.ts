/* eslint-env mocha */
import { createVerifiedFetch } from '@helia/verified-fetch'
import { expect } from 'aegir/chai'
import { CID } from 'multiformats/cid'
import { createKuboNode } from './fixtures/create-kubo.js'
import { loadFixtureDataCar } from './fixtures/load-fixture-data.js'
import type { Controller } from 'ipfsd-ctl'

describe('@helia/verified-fetch - json', () => {
  describe('unixfs - multiblock', () => {
    let controller: Controller<'go'>
    let verifiedFetch: Awaited<ReturnType<typeof createVerifiedFetch>>

    before(async () => {
      controller = await createKuboNode()
      await controller.start()
      // As of 2024-01-18, https://cloudflare-ipfs.com/ipns/tokens.uniswap.org resolves to:
      // root: QmQJ8fxavY54CUsxMSx9aE9Rdcmvhx8awJK2jzJp4iAqCr
      // child1: QmNik5N4ryNwzzXYq5hCYKGcRjAf9QtigxtiJh9o8aXXbG // partial JSON
      // child2: QmWNBJX6fZyNTLWNYBHxAHpBctCP43R2zeqV2G8uavqFZn // partial JSON
      await loadFixtureDataCar(controller, 'QmQJ8fxavY54CUsxMSx9aE9Rdcmvhx8awJK2jzJp4iAqCr-tokens.uniswap.org-2024-01-18.car')
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

    it('handles UnixFS-chunked JSON file', async () => {
      const resp = await verifiedFetch(CID.parse('QmQJ8fxavY54CUsxMSx9aE9Rdcmvhx8awJK2jzJp4iAqCr'))
      expect(resp).to.be.ok()
      const jsonObj = await resp.json()
      expect(jsonObj).to.be.ok()
      expect(jsonObj).to.have.property('name').equal('Uniswap Labs Default')
      expect(jsonObj).to.have.property('timestamp').equal('2023-12-13T18:25:25.830Z')
      expect(jsonObj).to.have.property('version').to.deep.equal({ major: 11, minor: 11, patch: 0 })
      expect(jsonObj).to.have.property('tags')
      expect(jsonObj).to.have.property('logoURI').equal('ipfs://QmNa8mQkrNKp1WEEeGjFezDmDeodkWRevGFN8JCV7b4Xir')
      expect(jsonObj).to.have.property('keywords').to.deep.equal(['uniswap', 'default'])
      expect(jsonObj.tokens).to.be.an('array').of.length(767)
    })
  })
})
