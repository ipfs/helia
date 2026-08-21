import { expect } from 'aegir/chai'
import { stubInterface } from 'sinon-ts'
import { libp2pDefaults } from '../src/utils/libp2p-defaults.ts'
import type { CreateLibp2pOptions } from '../src/index.ts'
import type { DNS } from '@multiformats/dns'

describe('libp2p-defaults', () => {
  it('should return defaults', () => {
    const options = libp2pDefaults()

    expect(options).to.have.property('addresses').that.is.an('object')
  })

  it('should accept options', () => {
    const opts = {
      foo: 'bar',
      dns: stubInterface<DNS>()
    }
    const options = libp2pDefaults(opts)

    expect(options.foo).to.equal('bar')
  })

  it('should merge defaults', () => {
    const defaults = libp2pDefaults()

    const extra: CreateLibp2pOptions = {
      config: 'merge',
      streamMuxers: [
        stubInterface()
      ]
    }

    const updated = libp2pDefaults(extra)
    expect(updated.streamMuxers.length).to.be.greaterThan(defaults.streamMuxers.length)
  })

  it('should replace defaults', () => {
    const extra: CreateLibp2pOptions = {
      config: 'replace',
      streamMuxers: [
        stubInterface()
      ]
    }

    const updated = libp2pDefaults(extra)
    expect(updated.streamMuxers.length).to.equal(1)
  })
})
