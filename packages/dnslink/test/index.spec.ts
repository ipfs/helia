/* eslint-env mocha */

import { NotFoundError } from '@libp2p/interface'
import { defaultLogger } from '@libp2p/logger'
import { peerIdFromString } from '@libp2p/peer-id'
import { RecordType } from '@multiformats/dns'
import { expect } from 'aegir/chai'
import { base36 } from 'multiformats/bases/base36'
import { CID } from 'multiformats/cid'
import { stubInterface } from 'sinon-ts'
import { dnsLink } from '../src/index.js'
import type { DNSLink } from '../src/index.js'
import type { Answer, DNS, DNSResponse } from '@multiformats/dns'
import type { StubbedInstance } from 'sinon-ts'

function dnsResponse (answers: Answer[]): DNSResponse {
  return {
    Status: 0,
    TC: true,
    RD: true,
    RA: true,
    AD: true,
    CD: true,
    Question: [],
    Answer: answers
  }
}

describe('dnslink', () => {
  let dns: StubbedInstance<DNS>
  let name: DNSLink

  beforeEach(async () => {
    dns = stubInterface()
    name = dnsLink({
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

    const result = await name.resolve('foobar.baz', { nocache: true, offline: true })
    expect(result).to.have.deep.nested.property('[0].cid', CID.parse('QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn'))
    expect(result).to.have.nested.property('[0].path', '')
  })

  it('should resolve a domain to multiple values', async () => {
    dns.query.withArgs('_dnslink.foobar.baz').resolves(dnsResponse([{
      name: '_dnslink.foobar.baz.',
      TTL: 60,
      type: RecordType.TXT,
      data: 'dnslink=/ipfs/QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn'
    }, {
      name: '_dnslink.foobar.baz.',
      TTL: 60,
      type: RecordType.TXT,
      data: 'dnslink=/ipfs/bafybeifcaqowoyito3qvsmbwbiugsu4umlxn4ehu223hvtubbfvwyuxjoe'
    }]))

    const result = await name.resolve('foobar.baz', { nocache: true, offline: true })
    expect(result).to.have.deep.nested.property('[0].cid', CID.parse('bafybeifcaqowoyito3qvsmbwbiugsu4umlxn4ehu223hvtubbfvwyuxjoe'))
    expect(result).to.have.nested.property('[0].path', '')
    expect(result).to.have.deep.nested.property('[1].cid', CID.parse('QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn'))
    expect(result).to.have.nested.property('[1].path', '')
  })

  it('should retry without `_dnslink.` on a domain', async () => {
    dns.query.withArgs('_dnslink.foobar.baz').rejects(new NotFoundError('Not found'))
    dns.query.withArgs('foobar.baz').resolves(dnsResponse([{
      name: 'foobar.baz.',
      TTL: 60,
      type: RecordType.TXT,
      data: 'dnslink=/ipfs/QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn'
    }]))

    const result = await name.resolve('foobar.baz', { nocache: true, offline: true })
    expect(result).to.have.deep.nested.property('[0].cid', CID.parse('QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn'))
    expect(result).to.have.nested.property('[0].path', '')
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

    const result = await name.resolve('foobar.baz', { nocache: true, offline: true })
    expect(result).to.have.deep.nested.property('[0].cid', CID.parse('QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn'))
  })

  it('should handle records wrapped in quotation marks', async () => {
    dns.query.withArgs('_dnslink.foobar.baz').resolves(dnsResponse([{
      name: 'foobar.baz.',
      TTL: 60,
      type: RecordType.TXT,
      data: '"dnslink=/ipfs/QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn"'
    }]))

    const result = await name.resolve('foobar.baz', { nocache: true, offline: true })
    expect(result).to.have.deep.nested.property('[0].cid', CID.parse('QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn'))
  })

  it('should support trailing slash in returned dnslink value', async () => {
    // see https://github.com/ipfs/helia/issues/402
    dns.query.withArgs('_dnslink.foobar.baz').resolves(dnsResponse([{
      name: 'foobar.baz.',
      TTL: 60,
      type: RecordType.TXT,
      // spellchecker:disable-next-line
      data: 'dnslink=/ipfs/bafybeifcaqowoyito3qvsmbwbiugsu4umlxn4ehu223hvtubbfvwyuxjoe/'
    }]))

    const result = await name.resolve('foobar.baz', { nocache: true })
    // spellchecker:disable-next-line
    expect(result).to.have.deep.nested.property('[0].cid', CID.parse('bafybeifcaqowoyito3qvsmbwbiugsu4umlxn4ehu223hvtubbfvwyuxjoe'), 'doesn\'t support trailing slashes')
  })

  it('should support paths in returned dnslink value', async () => {
    // see https://github.com/ipfs/helia/issues/402
    dns.query.withArgs('_dnslink.foobar.baz').resolves(dnsResponse([{
      name: 'foobar.baz.',
      TTL: 60,
      type: RecordType.TXT,
      // spellchecker:disable-next-line
      data: 'dnslink=/ipfs/bafybeifcaqowoyito3qvsmbwbiugsu4umlxn4ehu223hvtubbfvwyuxjoe/foobar/path/123'
    }]))

    const result = await name.resolve('foobar.baz', { nocache: true })
    // spellchecker:disable-next-line
    expect(result).to.have.deep.nested.property('[0].cid', CID.parse('bafybeifcaqowoyito3qvsmbwbiugsu4umlxn4ehu223hvtubbfvwyuxjoe'), 'doesn\'t support trailing paths')
    expect(result).to.have.nested.property('[0].path', '/foobar/path/123')
  })

  it('should resolve recursive dnslink -> <peerId>/<path>', async () => {
    const peerId = peerIdFromString('QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn')

    dns.query.withArgs('_dnslink.foobar.baz').resolves(dnsResponse([{
      name: 'foobar.baz.',
      TTL: 60,
      type: RecordType.TXT,
      data: `dnslink=/ipns/${peerId.toString()}/foobar/path/123`
    }]))

    const result = await name.resolve('foobar.baz')

    if (result == null) {
      throw new Error('Did not resolve entry')
    }

    expect(result).to.have.deep.nested.property('[0].peerId', peerId)
    expect(result).to.have.nested.property('[0].path', '/foobar/path/123')
  })

  it('should resolve recursive dnslink -> <IPNS_base36_CID>/<path>', async () => {
    const peerId = peerIdFromString('QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn')
    const peerIdBase36CID = peerId.toCID().toString(base36)
    dns.query.withArgs('_dnslink.foobar.baz').resolves(dnsResponse([{
      name: 'foobar.baz.',
      TTL: 60,
      type: RecordType.TXT,
      data: `dnslink=/ipns/${peerIdBase36CID}/foobar/path/123`
    }]))

    const result = await name.resolve('foobar.baz')

    if (result == null) {
      throw new Error('Did not resolve entry')
    }

    expect(result).to.have.deep.nested.property('[0].peerId', peerId)
    expect(result).to.have.nested.property('[0].path', '/foobar/path/123')
  })

  it('should follow CNAMES to delegated DNSLink domains', async () => {
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
      // spellchecker:disable-next-line
      data: 'dnslink=/ipfs/bafybeifcaqowoyito3qvsmbwbiugsu4umlxn4ehu223hvtubbfvwyuxjoe'
    }]))
    const result = await name.resolve('foobar.baz')

    if (result == null) {
      throw new Error('Did not resolve entry')
    }

    expect(result).to.have.deep.nested.property('[0].cid', CID.parse('bafybeifcaqowoyito3qvsmbwbiugsu4umlxn4ehu223hvtubbfvwyuxjoe'))
  })

  it('should resolve dnslink namespace', async () => {
    const cid = CID.parse('bafybeifcaqowoyito3qvsmbwbiugsu4umlxn4ehu223hvtubbfvwyuxjoe')
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
      // spellchecker:disable-next-line
      data: 'dnslink=/ipfs/bafybeifcaqowoyito3qvsmbwbiugsu4umlxn4ehu223hvtubbfvwyuxjoe'
    }]))

    const result = await name.resolve('foobar.baz')

    if (result == null) {
      throw new Error('Did not resolve entry')
    }

    expect(result).to.have.deep.nested.property('[0].cid', cid)
  })

  it('should include DNS Answer in result', async () => {
    const answer = {
      name: '_dnslink.foobar.baz.',
      TTL: 60,
      type: RecordType.TXT,
      // spellchecker:disable-next-line
      data: 'dnslink=/ipfs/bafybeifcaqowoyito3qvsmbwbiugsu4umlxn4ehu223hvtubbfvwyuxjoe'
    }
    dns.query.withArgs('_dnslink.foobar.baz').resolves(dnsResponse([answer]))

    const result = await name.resolve('foobar.baz')

    if (result == null) {
      throw new Error('Did not resolve entry')
    }

    expect(result).to.have.deep.nested.property('[0].answer', answer)
  })

  it('should support custom parsers', async () => {
    const answer = {
      name: '_dnslink.foobar.baz.',
      TTL: 60,
      type: RecordType.TXT,
      // spellchecker:disable-next-line
      data: 'dnslink=/hello/world'
    }
    dns.query.withArgs('_dnslink.foobar.baz').resolves(dnsResponse([answer]))

    name = dnsLink({
      dns,
      logger: defaultLogger()
    }, {
      namespaces: {
        hello: {
          parse: (value, answer) => {
            return {
              namespace: 'hello',
              value: value.split('/hello/').pop(),
              answer
            }
          }
        }
      }
    })

    const result = await name.resolve('foobar.baz')

    expect(result).to.have.nested.property('[0].namespace', 'hello')
    expect(result).to.have.nested.property('[0].value', 'world')
  })
})
