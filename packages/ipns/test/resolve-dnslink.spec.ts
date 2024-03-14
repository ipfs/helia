/* eslint-env mocha */

import { CodeError } from '@libp2p/interface'
import { defaultLogger } from '@libp2p/logger'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { RecordType } from '@multiformats/dns'
import { expect } from 'aegir/chai'
import { MemoryDatastore } from 'datastore-core'
import { type Datastore } from 'interface-datastore'
import { CID } from 'multiformats/cid'
import { type StubbedInstance, stubInterface } from 'sinon-ts'
import { ipns, type IPNS } from '../src/index.js'
import type { Routing } from '@helia/interface'
import type { DNS, Answer, DNSResponse } from '@multiformats/dns'

function dnsResponse (ansers: Answer[]): DNSResponse {
  return {
    Status: 0,
    TC: true,
    RD: true,
    RA: true,
    AD: true,
    CD: true,
    Question: [],
    Answer: ansers
  }
}

describe('resolveDNSLink', () => {
  let datastore: Datastore
  let heliaRouting: StubbedInstance<Routing>
  let dns: StubbedInstance<DNS>
  let name: IPNS

  beforeEach(async () => {
    datastore = new MemoryDatastore()
    heliaRouting = stubInterface<Routing>()
    dns = stubInterface<DNS>()

    name = ipns({
      datastore,
      routing: heliaRouting,
      dns,
      logger: defaultLogger()
    })
  })

  it('should resolve a domain', async () => {
    dns.query.withArgs('_dnslink.foobar.baz').resolves(dnsResponse([{
      name: '_dnslink.foobar.baz.',
      TTL: 60,
      type: RecordType.TXT,
      data: 'dnslink=/ipfs/QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn'
    }]))

    const result = await name.resolveDNSLink('foobar.baz', { nocache: true, offline: true })
    expect(result.cid.toString()).to.equal('QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn')
  })

  it('should retry without `_dnslink.` on a domain', async () => {
    dns.query.withArgs('_dnslink.foobar.baz').rejects(new CodeError('Not found', 'ENOTFOUND'))
    dns.query.withArgs('foobar.baz').resolves(dnsResponse([{
      name: 'foobar.baz.',
      TTL: 60,
      type: RecordType.TXT,
      data: 'dnslink=/ipfs/QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn'
    }]))

    const result = await name.resolveDNSLink('foobar.baz', { nocache: true, offline: true })
    expect(result.cid.toString()).to.equal('QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn')
  })

  it('should handle bad records', async () => {
    dns.query.withArgs('_dnslink.foobar.baz').resolves(dnsResponse([{
      name: 'foobar.baz.',
      TTL: 60,
      type: RecordType.TXT,
      data: 'dnslink'
    }, {
      name: 'foobar.baz.',
      TTL: 60,
      type: RecordType.TXT,
      data: 'dnslink=invalid'
    }, {
      name: 'foobar.baz.',
      TTL: 60,
      type: RecordType.TXT,
      data: 'bad text record'
    }, {
      name: 'foobar.baz.',
      TTL: 60,
      type: RecordType.TXT,
      data: 'dnslink=/hyper/link-for-other-namespace'
    }, {
      name: 'foobar.baz.',
      TTL: 60,
      type: RecordType.TXT,
      data: 'dnslink=/ipfs/invalid cid'
    }, {
      name: 'foobar.baz.',
      TTL: 60,
      type: RecordType.TXT,
      data: 'dnslink=/ipfs/QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn'
    }]))

    const result = await name.resolveDNSLink('foobar.baz', { nocache: true, offline: true })
    expect(result.cid.toString()).to.equal('QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn')
  })

  it('should handle records wrapped in quotation marks', async () => {
    dns.query.withArgs('_dnslink.foobar.baz').resolves(dnsResponse([{
      name: 'foobar.baz.',
      TTL: 60,
      type: RecordType.TXT,
      data: '"dnslink=/ipfs/QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn"'
    }]))

    const result = await name.resolveDNSLink('foobar.baz', { nocache: true, offline: true })
    expect(result.cid.toString()).to.equal('QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn')
  })

  it('should support trailing slash in returned dnslink value', async () => {
    // see https://github.com/ipfs/helia/issues/402
    dns.query.withArgs('_dnslink.foobar.baz').resolves(dnsResponse([{
      name: 'foobar.baz.',
      TTL: 60,
      type: RecordType.TXT,
      data: 'dnslink=/ipfs/bafybeifcaqowoyito3qvsmbwbiugsu4umlxn4ehu223hvtubbfvwyuxjoe/'
    }]))

    const result = await name.resolveDNSLink('foobar.baz', { nocache: true })
    expect(result.cid.toString()).to.equal('bafybeifcaqowoyito3qvsmbwbiugsu4umlxn4ehu223hvtubbfvwyuxjoe', 'doesn\'t support trailing slashes')
  })

  it('should support paths in returned dnslink value', async () => {
    // see https://github.com/ipfs/helia/issues/402
    dns.query.withArgs('_dnslink.foobar.baz').resolves(dnsResponse([{
      name: 'foobar.baz.',
      TTL: 60,
      type: RecordType.TXT,
      data: 'dnslink=/ipfs/bafybeifcaqowoyito3qvsmbwbiugsu4umlxn4ehu223hvtubbfvwyuxjoe/foobar/path/123'
    }]))

    const result = await name.resolveDNSLink('foobar.baz', { nocache: true })
    expect(result.cid.toString()).to.equal('bafybeifcaqowoyito3qvsmbwbiugsu4umlxn4ehu223hvtubbfvwyuxjoe', 'doesn\'t support trailing slashes')
    expect(result.path).to.equal('foobar/path/123')
  })

  it('should resolve recursive dnslink -> <peerId>/<path>', async () => {
    const cid = CID.parse('QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn')
    const key = await createEd25519PeerId()
    dns.query.withArgs('_dnslink.foobar.baz').resolves(dnsResponse([{
      name: 'foobar.baz.',
      TTL: 60,
      type: RecordType.TXT,
      data: `dnslink=/ipns/${key}/foobar/path/123`
    }]))

    await name.publish(key, cid)

    const result = await name.resolveDNSLink('foobar.baz', { nocache: true })

    if (result == null) {
      throw new Error('Did not resolve entry')
    }

    expect(result.cid.toString()).to.equal(cid.toV1().toString())
    expect(result.path).to.equal('foobar/path/123')
  })

  it('should follow CNAMES to delegated DNSLink domains', async () => {
    const cid = CID.parse('bafybeifcaqowoyito3qvsmbwbiugsu4umlxn4ehu223hvtubbfvwyuxjoe')
    const key = await createEd25519PeerId()
    dns.query.withArgs('_dnslink.foobar.baz').resolves(dnsResponse([{
      name: '_dnslink.foobar.baz.',
      TTL: 60,
      type: RecordType.CNAME,
      data: '_dnslink.delegated.foobar.baz'
    }]))
    dns.query.withArgs('_dnslink.delegated.foobar.baz').resolves(dnsResponse([{
      name: '_dnslink.delegated.foobar.baz.',
      TTL: 60,
      type: RecordType.TXT,
      data: 'dnslink=/ipfs/bafybeifcaqowoyito3qvsmbwbiugsu4umlxn4ehu223hvtubbfvwyuxjoe'
    }]))

    await name.publish(key, cid)

    const result = await name.resolveDNSLink('foobar.baz', { nocache: true })

    if (result == null) {
      throw new Error('Did not resolve entry')
    }

    expect(result.cid.toString()).to.equal(cid.toV1().toString())
  })

  it('should resolve dnslink namespace', async () => {
    const cid = CID.parse('bafybeifcaqowoyito3qvsmbwbiugsu4umlxn4ehu223hvtubbfvwyuxjoe')
    const key = await createEd25519PeerId()
    dns.query.withArgs('_dnslink.foobar.baz').resolves(dnsResponse([{
      name: '_dnslink.foobar.baz.',
      TTL: 60,
      type: RecordType.TXT,
      data: 'dnslink=/dnslink/delegated.foobar.baz'
    }]))
    dns.query.withArgs('_dnslink.delegated.foobar.baz').resolves(dnsResponse([{
      name: '_dnslink.delegated.foobar.baz.',
      TTL: 60,
      type: RecordType.TXT,
      data: 'dnslink=/ipfs/bafybeifcaqowoyito3qvsmbwbiugsu4umlxn4ehu223hvtubbfvwyuxjoe'
    }]))

    await name.publish(key, cid)

    const result = await name.resolveDNSLink('foobar.baz', { nocache: true })

    if (result == null) {
      throw new Error('Did not resolve entry')
    }

    expect(result.cid.toString()).to.equal(cid.toV1().toString())
  })

  it('should include DNS Answer in result', async () => {
    const cid = CID.parse('bafybeifcaqowoyito3qvsmbwbiugsu4umlxn4ehu223hvtubbfvwyuxjoe')
    const key = await createEd25519PeerId()
    const answer = {
      name: '_dnslink.foobar.baz.',
      TTL: 60,
      type: RecordType.TXT,
      data: 'dnslink=/ipfs/bafybeifcaqowoyito3qvsmbwbiugsu4umlxn4ehu223hvtubbfvwyuxjoe'
    }
    dns.query.withArgs('_dnslink.foobar.baz').resolves(dnsResponse([answer]))

    await name.publish(key, cid)

    const result = await name.resolveDNSLink('foobar.baz', { nocache: true })

    if (result == null) {
      throw new Error('Did not resolve entry')
    }

    expect(result).to.have.deep.property('answer', answer)
  })
})
