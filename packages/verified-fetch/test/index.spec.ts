/* eslint-env mocha */
import { createHeliaHTTP } from '@helia/http'
import { createVerifiedFetch } from '../src/index.js'
import { expect } from 'aegir/chai'

describe('createVerifiedFetch', () => {
  it('Can be constructed with a HeliaHttp instance', async () => {
    const heliaHttp = await createHeliaHTTP()
    const verifiedFetch = await createVerifiedFetch(heliaHttp)

    expect(verifiedFetch).to.be.ok()
    await verifiedFetch.stop()
  })

  /**
   * Currently erroring:
   *
   * Error: Package subpath './peer-job-queue' is not defined by "exports" in /Users/sgtpooki/code/work/protocol.ai/ipfs/helia/node_modules/@libp2p/utils/package.json imported from /Users/sgtpooki/code/work/protocol.ai/ipfs/helia/node_modules/@libp2p/circuit-relay-v2/dist/src/transport/reservation-store.js
   *  at new NodeError (node:internal/errors:406:5)
   *  at exportsNotFound (node:internal/modules/esm/resolve:268:10)
   *  at packageExportsResolve (node:internal/modules/esm/resolve:598:9)
   *  at packageResolve (node:internal/modules/esm/resolve:772:14)
   *  at moduleResolve (node:internal/modules/esm/resolve:838:20)
   *  at defaultResolve (node:internal/modules/esm/resolve:1043:11)
   *  at ModuleLoader.defaultResolve (node:internal/modules/esm/loader:383:12)
   *  at ModuleLoader.resolve (node:internal/modules/esm/loader:352:25)
   *  at ModuleLoader.getModuleJob (node:internal/modules/esm/loader:228:38)
   *  at ModuleWrap.<anonymous> (node:internal/modules/esm/module_job:85:39)
   *  at link (node:internal/modules/esm/module_job:84:36)
   */
  // it('Can be constructed with a HeliaP2P instance', async () => {
  //   const heliaP2P = await createHelia()
  //   const verifiedFetch = await createVerifiedFetch(heliaP2P)

  //   expect(verifiedFetch).to.be.ok()
  //   await heliaP2P.stop()
  // })

  it('Can be constructed with gateways', async () => {
    const verifiedFetch = await createVerifiedFetch({
      gateways: ['https://127.0.0.1']
    })
    expect(verifiedFetch).to.be.ok()
    await verifiedFetch.stop()
  })

  it('Can be constructed with gateways & routers', async () => {
    const verifiedFetch = await createVerifiedFetch({
      gateways: ['https://127.0.0.1'],
      routers: ['https://127.0.0.1']
    })
    expect(verifiedFetch).to.be.ok()
    await verifiedFetch.stop()
  })
})
