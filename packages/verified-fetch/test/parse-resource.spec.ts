import { defaultLogger } from '@libp2p/logger'
import { expect } from 'aegir/chai'
import { CID } from 'multiformats/cid'
import sinon from 'sinon'
import { stubInterface } from 'sinon-ts'
import { parseResource } from '../src/utils/parse-resource.js'
import type { IPNS } from '@helia/ipns'

describe('parseResource', () => {
  it('does not call @helia/ipns for CID', async () => {
    const testCID = CID.parse('QmQJ8fxavY54CUsxMSx9aE9Rdcmvhx8awJK2jzJp4iAqCr')
    const shouldNotBeCalled1 = sinon.stub().throws(new Error('should not be called'))
    const shouldNotBeCalled2 = sinon.stub().throws(new Error('should not be called'))
    const { cid, path, query } = await parseResource(testCID, {
      ipns: stubInterface<IPNS>({
        resolveDns: shouldNotBeCalled1,
        resolve: shouldNotBeCalled2
      }),
      logger: defaultLogger()
    })
    expect(shouldNotBeCalled1.called).to.be.false()
    expect(shouldNotBeCalled2.called).to.be.false()
    expect(cid.toString()).to.equal(testCID.toString())
    expect(path).to.equal('')
    expect(query).to.deep.equal({})
  })

  it('throws an error if given an invalid resource', async () => {
    // @ts-expect-error - purposefully invalid input
    await expect(parseResource({}, stubInterface<IPNS>())).to.be.rejectedWith('Invalid resource.')
  })
})
