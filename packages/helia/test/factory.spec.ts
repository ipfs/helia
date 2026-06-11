import { expect } from 'aegir/chai'
import { Key } from 'interface-datastore'
import { CID } from 'multiformats/cid'
import { createHelia } from '../src/index.ts'
import type { Helia } from '@helia/interface'

describe('helia factory', () => {
  let helia: Helia

  afterEach(async () => {
    if (helia != null) {
      await helia.stop()
    }
  })

  it('allows creating offline node', async () => {
    helia = createHelia()

    expect(helia.status).to.equal('stopped')
  })

  it('does not require any constructor args', async () => {
    helia = createHelia()

    const cid = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3F')
    const block = Uint8Array.from([0, 1, 2, 3])
    await helia.blockstore.put(cid, block)
    expect(await helia.blockstore.has(cid)).to.be.true()

    const key = new Key(`/${cid.toString()}`)
    await helia.datastore.put(key, block)
    expect(await helia.datastore.has(key)).to.be.true()
  })

  it('adds helia details to the AgentVersion', async () => {
    helia = createHelia()

    expect(helia).to.have.nested.property('libp2p.services.identify.host.agentVersion')
      .that.includes('helia/')
  })
})
