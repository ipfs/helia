import { defaultLogger } from '@libp2p/logger'
import { expect } from 'aegir/chai'
import all from 'it-all'
import { CID } from 'multiformats/cid'
import { stubInterface } from 'sinon-ts'
import { Routing } from '../src/routing.js'
import type { StubbedInstance } from 'sinon-ts'

describe('routing', () => {
  let routing: Routing
  let routerA: StubbedInstance<Routing>
  let routerB: StubbedInstance<Routing>

  beforeEach(() => {
    routerA = stubInterface<Routing>()
    routerB = stubInterface<Routing>()

    routing = new Routing({
      logger: defaultLogger()
    }, {
      routers: [
        routerA,
        routerB
      ]
    })
  })

  it('should end a provider lookup that finds no results', async () => {
    const key = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3E')

    routerA.findProviders.returns((async function * () {})())
    routerB.findProviders.returns((async function * () {})())

    const results = await all(routing.findProviders(key))

    expect(results).to.be.empty()
  })
})
