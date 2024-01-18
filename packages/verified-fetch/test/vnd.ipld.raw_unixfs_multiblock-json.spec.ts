import { expect } from 'aegir/chai'
import drain from 'it-drain'
import { CID } from 'multiformats/cid'
import { createVerifiedFetch } from '../src/index.js'
import { createKuboNode } from './fixtures/create-kubo.js'
import { importContentToKuboNode } from './fixtures/import-content-to-kubo-node.js'
import type { Controller } from 'ipfsd-ctl'

describe('vnd.ipld.raw - unixfs - multiblock-json', () => {
  let controller: Controller<'go'>

  beforeEach(async () => {
    controller = await createKuboNode()
    await controller.start()
  })

  afterEach(async () => {
    await controller.stop()
  })

  // As of 2024-01-18, https://cloudflare-ipfs.com/ipns/tokens.uniswap.org resolves to:
  // root: QmQJ8fxavY54CUsxMSx9aE9Rdcmvhx8awJK2jzJp4iAqCr
  // child1: QmNik5N4ryNwzzXYq5hCYKGcRjAf9QtigxtiJh9o8aXXbG // partial JSON
  // child2: QmWNBJX6fZyNTLWNYBHxAHpBctCP43R2zeqV2G8uavqFZn // partial JSON
  it('handles uniswap tokens list json', async () => {
    // add the root node to the kubo node
    await drain(await importContentToKuboNode(controller, '/ipfs/QmQJ8fxavY54CUsxMSx9aE9Rdcmvhx8awJK2jzJp4iAqCr'))

    const verifiedFetch = await createVerifiedFetch({
      gateways: [`http://${controller.api.gatewayHost}:${controller.api.gatewayPort}`]
    })

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
