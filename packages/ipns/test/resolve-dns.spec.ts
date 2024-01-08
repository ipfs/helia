/* eslint-env mocha */

import { expect } from 'aegir/chai'
import { MemoryDatastore } from 'datastore-core'
import { type Datastore } from 'interface-datastore'
import { stub } from 'sinon'
import { type StubbedInstance, stubInterface } from 'sinon-ts'
import { type IPNSRouting, ipns } from '../src/index.js'

describe('resolveDns', () => {
  let routing: StubbedInstance<IPNSRouting>
  let datastore: Datastore

  beforeEach(async () => {
    datastore = new MemoryDatastore()
    routing = stubInterface<IPNSRouting>()
    routing.get.throws(new Error('Not found'))
  })

  it('should use resolvers passed in constructor', async () => {
    const stubbedResolver1 = stub().returns('dnslink=/ipfs/QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn')

    const name = ipns({ datastore }, { routers: [routing], resolvers: [stubbedResolver1] })
    const result = await name.resolveDns('foobar.baz', { nocache: true, offline: true })
    expect(stubbedResolver1.called).to.be.true()
    expect(stubbedResolver1.calledWith('foobar.baz')).to.be.true()
    expect(result.toString()).to.equal('QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn')
  })

  it('should allow overriding of resolvers passed in constructor', async () => {
    const stubbedResolver1 = stub().returns('dnslink=/ipfs/QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn')
    const stubbedResolver2 = stub().returns('dnslink=/ipfs/bafkreibm6jg3ux5qumhcn2b3flc3tyu6dmlb4xa7u5bf44yegnrjhc4yeq')

    const name = ipns({ datastore }, { routers: [routing], resolvers: [stubbedResolver1] })
    const result = await name.resolveDns('foobar.baz', { nocache: true, offline: true, resolvers: [stubbedResolver2] })
    expect(stubbedResolver1.called).to.be.false()
    expect(stubbedResolver2.called).to.be.true()
    expect(stubbedResolver2.calledWith('foobar.baz')).to.be.true()
    expect(result.toString()).to.equal('bafkreibm6jg3ux5qumhcn2b3flc3tyu6dmlb4xa7u5bf44yegnrjhc4yeq')
  })
})
