import { expect } from 'aegir/chai'
import { defaultLogger } from 'birnam'
import all from 'it-all'
import { CID } from 'multiformats/cid'
import { stubInterface } from 'sinon-ts'
import { Routing } from '../src/routing.ts'
import type { Provider, Router } from '@helia/interface'
import type { Multiaddr } from '@multiformats/multiaddr'
import type { StubbedInstance } from 'sinon-ts'

describe('routing', () => {
  let routing: Routing
  let routerA: StubbedInstance<Router>
  let routerB: StubbedInstance<Router>

  beforeEach(() => {
    routerA = stubInterface<Router>({
      name: 'routerA'
    })
    routerB = stubInterface<Router>({
      name: 'routerB'
    })

    routerA.capabilities?.returns([])
    routerB.capabilities?.returns([])

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

    routerA.findProviders?.returns((async function * () {})())
    routerB.findProviders?.returns((async function * () {})())

    await expect(all(routing.findProviders(key))).to.eventually.be.empty()
  })

  it('should call routers in declaration order', async () => {
    const key = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3E')

    let firstRouter: null | string = null

    // eslint-disable-next-line require-yield
    routerA.findProviders?.returns((async function * () {
      if (firstRouter == null) {
        firstRouter = 'a'
      }
    })())
    // eslint-disable-next-line require-yield
    routerB.findProviders?.returns((async function * () {
      if (firstRouter == null) {
        firstRouter = 'b'
      }
    })())

    await expect(all(routing.findProviders(key))).to.eventually.be.empty()
    expect(firstRouter).to.equal('a')
  })

  it('should use a fallback router after a regular router', async () => {
    const key = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3E')

    let firstRouter: null | string = null

    // eslint-disable-next-line require-yield
    routerA.findProviders?.returns((async function * () {
      if (firstRouter == null) {
        firstRouter = 'a'
      }
    })())
    // eslint-disable-next-line require-yield
    routerB.findProviders?.returns((async function * () {
      if (firstRouter == null) {
        firstRouter = 'b'
      }
    })())

    routerA.capabilities?.returns(['fallback'])

    await expect(all(routing.findProviders(key))).to.eventually.be.empty()
    expect(firstRouter).to.equal('b')
  })

  it('should not use a fallback router if a regular router finds providers', async () => {
    const key = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3E')

    routerA.findProviders?.returns((async function * () {})())
    routerB.findProviders?.returns((async function * () {
      yield stubInterface<Provider>({
        multiaddrs: [stubInterface<Multiaddr>()]
      })
    })())

    routerA.capabilities?.returns(['fallback'])

    await expect(all(routing.findProviders(key))).to.eventually.have.lengthOf(1, 'did not find provider')
    expect(routerA.findProviders?.called).to.be.false('called fallback router')
    expect(routerB.findProviders?.called).to.be.true('did not call regular router')
  })
})
