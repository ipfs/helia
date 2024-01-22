// import { trustlessGateway } from '@helia/block-brokers'
// import { createHeliaHTTP } from '@helia/http'
import { expect } from 'aegir/chai'
// import drain from 'it-drain'
// import { LevelBlockstore } from 'blockstore-level'
// import { LevelDatastore } from 'datastore-level'
import { createVerifiedFetch } from '../../../verified-fetch/src/index.js'
import { createKuboNode } from '../../../verified-fetch/test/fixtures/create-kubo.js'
// import { importContentToKuboNode } from './fixtures/import-content-to-kubo-node.js'
// import type { Helia } from '@helia/interface'
import type { Controller } from 'ipfsd-ctl'

// TODO: Move to interop tests
describe.skip('vnd.ipld.raw - unixfs - websites', function () {
  // this.timeout(5 * 60 * 1000) // 5 minutes
  let controller: Controller<'go'>
  let verifiedFetch: Awaited<ReturnType<typeof createVerifiedFetch>>
  // let heliaNode: Helia
  before(async () => {
    controller = await createKuboNode()
    await controller.start()
    // heliaNode = await createHeliaHTTP({
    //   datastore: new LevelDatastore('./test/tmp/helia-node/datastore'),
    //   blockstore: new LevelBlockstore('./test/tmp/helia-node/blockstore'),
    //   blockBrokers: [
    //     trustlessGateway({
    //       gateways: [`http://${controller.api.gatewayHost}:${controller.api.gatewayPort}`, 'http://127.0.0.1:8081']
    //     })
    //   ]
    // })
    verifiedFetch = await createVerifiedFetch({
      // gateways: [`http://${controller.api.gatewayHost}:${controller.api.gatewayPort}`, 'http://127.0.0.1:8081', 'http://trustless-gateway.link'],
      // gateways: [`http://${controller.api.gatewayHost}:${controller.api.gatewayPort}`, 'http://trustless-gateway.link'],
      // gateways: [`http://${controller.api.gatewayHost}:${controller.api.gatewayPort}`, 'http://127.0.0.1:8081'],
      gateways: [`http://${controller.api.gatewayHost}:${controller.api.gatewayPort}`],
      // gateways: ['http://trustless-gateway.link'],
      // gateways: ['http://127.0.0.1:8081'],
      // routers: [`http://${controller.api.gatewayHost}:${controller.api.gatewayPort}`, 'http://127.0.0.1:8081', 'https://delegated-ipfs.dev']
      // routers: [`http://${controller.api.gatewayHost}:${controller.api.gatewayPort}`, 'http://127.0.0.1:8081']
      // routers: [`http://${controller.api.gatewayHost}:${controller.api.gatewayPort}`, 'https://delegated-ipfs.dev']
      routers: [`http://${controller.api.gatewayHost}:${controller.api.gatewayPort}`]
      // routers: []
    })
    // verifiedFetch = await createVerifiedFetch(heliaNode)
  })

  after(async () => {
    // await heliaNode.stop()
    await verifiedFetch.stop()
    await controller.stop()
  })

  it('can load helia-identify.on.fleek.co via ipns', async () => {
    // await drain(await importContentToKuboNode(controller, '/ipns/blog.ipfs.tech/index.html'))
    // await drain(await importContentToKuboNode(controller, '/ipfs/QmSRi6CV3E59MycSPicmoidCCPvAWxcRX8avkjh4rckfx8/index.html'))
    // await drain(await importContentToKuboNode(controller, '/ipns/helia-identify.on.fleek.co')) // QmbxpRxwKXxnJQjnPqm1kzDJSJ8YgkLxH23mcZURwPHjGv
    // await drain(await importContentToKuboNode(controller, '/ipns/helia-identify.on.fleek.co/index.html')) // QmbxpRxwKXxnJQjnPqm1kzDJSJ8YgkLxH23mcZURwPHjGv
    // await drain(await importContentToKuboNode(controller, '/ipfs/QmbxpRxwKXxnJQjnPqm1kzDJSJ8YgkLxH23mcZURwPHjGv/index.html')) // /ipns/helia-identify.on.fleek.co
    console.log('done importing to kubo')

    // const resp = await verifiedFetch('ipns://blog.ipfs.tech')
    // const resp = await verifiedFetch('ipfs://QmSRi6CV3E59MycSPicmoidCCPvAWxcRX8avkjh4rckfx8')
    // const resp = await verifiedFetch('ipns://helia-identify.on.fleek.co')
    const resp = await verifiedFetch('ipfs://QmbxpRxwKXxnJQjnPqm1kzDJSJ8YgkLxH23mcZURwPHjGv')

    expect(resp).to.be.ok()
    const html = await resp.text()
    expect(html).to.be.ok()
  })
})
