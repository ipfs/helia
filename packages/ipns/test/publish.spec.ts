/* eslint-env mocha */

import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { expect } from 'aegir/chai'
import { MemoryDatastore } from 'datastore-core'
import { CID } from 'multiformats/cid'
import Sinon from 'sinon'
import { type StubbedInstance, stubInterface } from 'sinon-ts'
import { ipns } from '../src/index.js'
import type { IPNS, IPNSRouting } from '../src/index.js'
import type { Routing } from '@helia/interface'

const cid = CID.parse('QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn')

describe('publish', () => {
  let name: IPNS
  let customRouting: StubbedInstance<IPNSRouting>
  let heliaRouting: StubbedInstance<Routing>

  beforeEach(async () => {
    const datastore = new MemoryDatastore()
    customRouting = stubInterface<IPNSRouting>()
    customRouting.get.throws(new Error('Not found'))
    heliaRouting = stubInterface<Routing>()

    name = ipns({ datastore, routing: heliaRouting }, { routers: [customRouting] })
  })

  it('should publish an IPNS record with the default params', async function () {
    const key = await createEd25519PeerId()
    const ipnsEntry = await name.publish(key, cid)

    expect(ipnsEntry).to.have.property('sequence', 1n)
    expect(ipnsEntry).to.have.property('ttl', 8640000000000n) // 24 hours
  })

  it('should publish an IPNS record with a custom ttl params', async function () {
    const key = await createEd25519PeerId()
    const lifetime = 123000
    const ipnsEntry = await name.publish(key, cid, {
      lifetime
    })

    expect(ipnsEntry).to.have.property('sequence', 1n)
    expect(ipnsEntry).to.have.property('ttl', BigInt(lifetime) * 100000n)

    expect(heliaRouting.put.called).to.be.true()
    expect(customRouting.put.called).to.be.true()
  })

  it('should publish a record offline', async () => {
    const key = await createEd25519PeerId()
    await name.publish(key, cid, {
      offline: true
    })

    expect(heliaRouting.put.called).to.be.false()
    expect(customRouting.put.called).to.be.false()
  })

  it('should emit progress events', async function () {
    const key = await createEd25519PeerId()
    const onProgress = Sinon.stub()
    await name.publish(key, cid, {
      onProgress
    })

    expect(onProgress).to.have.property('called', true)
  })
})
