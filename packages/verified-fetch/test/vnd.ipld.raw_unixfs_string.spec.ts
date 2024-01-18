import { expect } from 'aegir/chai'
// import { UnixFS } from 'ipfs-unixfs'
// import drain from 'it-drain'
// import { create } from 'kubo-rpc-client'
import { CID } from 'multiformats/cid'
import { createVerifiedFetch } from '../src/index.js'
// import { addContentToKuboNode } from './fixtures/add-content-to-kubo-node.js'
// import { importContentToKuboNode } from './fixtures/import-content-to-kubo-node.js'

describe('vnd.ipld.raw - unixfs - string', () => {
  // let rpcClient: ReturnType<typeof create>
  let verifiedFetch: Awaited<ReturnType<typeof createVerifiedFetch>>

  before(async () => {
    // rpcClient = create({
    //   url: `${process.env.KUBO_RPC_ENDPOINT}`
    // })

    verifiedFetch = await createVerifiedFetch({
      gateways: [`${process.env.KUBO_GATEWAY}`]
    })
  })

  after(async () => {
    await verifiedFetch.stop()
  })

  it('Can return a raw unixfs string', async () => {
    const givenString = 'hello sgtpooki from verified-fetch test'
    // const content = new UnixFS({ type: 'raw', data: (new TextEncoder()).encode(givenString) })
    // const { cid } = await addContentToKuboNode(rpcClient, content.marshal()) as { cid: CID }

    // expect(cid).to.be.ok()

    const resp = await verifiedFetch(CID.parse('QmSmceDbAf9iZp82B7HNSf1oQCck7DmUtMcP14kqnspfaA'))
    expect(resp).to.be.ok()
    const text = await resp.text()
    expect(text).to.equal(givenString)
  })

  it('Can return a string for unixfs pathed data', async () => {
    const ipfsUrl = 'ipfs://QmdmQXB2mzChmMeKY47C43LxUdg1NDJ5MWcKMKxDu7RgQm/1 - Barrel - Part 1/1 - Barrel - Part 1 - alt.txt'
    // await drain(await importContentToKuboNode(rpcClient, '/ipfs/QmdmQXB2mzChmMeKY47C43LxUdg1NDJ5MWcKMKxDu7RgQm/1 - Barrel - Part 1/1 - Barrel - Part 1 - alt.txt'))
    const resp = await verifiedFetch(ipfsUrl)
    expect(resp).to.be.ok()
    const text = await resp.text()
    expect(text).to.equal('Don\'t we all.')
  })
})
