/* eslint-env mocha */

import { expect } from 'aegir/chai'
import { createIPNS } from './fixtures/create-ipns.js'
import type { IPNS } from '../src/index.js'
import type { CreateIPNSResult } from './fixtures/create-ipns.js'

describe('shouldRepublish', () => {
  let name: IPNS
  let result: CreateIPNSResult

  beforeEach(async () => {
    result = await createIPNS()
    name = result.name
  })

  it('should return true when DHT expiry is within threshold', () => {
    // Access the private method via reflection
    const shouldRepublish = (name as any).shouldRepublish.bind(name)

    const now = Date.now()
    const created = new Date(now - 48 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000) // 36 hours ago (within 24h threshold)
    const record = {
      validity: new Date(now + 24 * 60 * 60 * 1000).toISOString() // Valid for 24 more hours
    }

    const result = shouldRepublish(record, created)
    expect(result).to.be.true()
  })

  it('should return true when record expiry is within threshold', () => {
    const shouldRepublish = (name as any).shouldRepublish.bind(name)

    const now = Date.now()
    const created = new Date(now - 12 * 60 * 60 * 1000) // 12 hours ago (DHT not expired)
    const record = {
      validity: new Date(now + 12 * 60 * 60 * 1000).toISOString() // Valid for only 12 more hours (within 24h threshold)
    }

    const result = shouldRepublish(record, created)
    expect(result).to.be.true()
  })

  it('should return false when both DHT and record expiry are beyond threshold', () => {
    const shouldRepublish = (name as any).shouldRepublish.bind(name)

    const now = Date.now()
    const created = new Date(now - 12 * 60 * 60 * 1000) // 12 hours ago
    const record = {
      validity: new Date(now + 36 * 60 * 60 * 1000).toISOString() // Valid for 36 more hours
    }

    const result = shouldRepublish(record, created)
    expect(result).to.be.false()
  })

  it('should return true when both expiries are within threshold', () => {
    const shouldRepublish = (name as any).shouldRepublish.bind(name)

    const now = Date.now()
    const created = new Date(now - 36 * 60 * 60 * 1000) // 36 hours ago (DHT within threshold)
    const record = {
      validity: new Date(now + 12 * 60 * 60 * 1000).toISOString() // Valid for 12 more hours (record within threshold)
    }

    const result = shouldRepublish(record, created)
    expect(result).to.be.true()
  })

  it('should handle edge case with very old DHT record', () => {
    const shouldRepublish = (name as any).shouldRepublish.bind(name)

    const now = Date.now()
    const created = new Date(now - 72 * 60 * 60 * 1000) // 72 hours ago (well past DHT expiry)
    const record = {
      validity: new Date(now + 48 * 60 * 60 * 1000).toISOString() // Valid for 48 more hours
    }

    const result = shouldRepublish(record, created)
    expect(result).to.be.true()
  })

  it('should handle edge case with expired record', () => {
    const shouldRepublish = (name as any).shouldRepublish.bind(name)

    const now = Date.now()
    const created = new Date(now - 12 * 60 * 60 * 1000) // 12 hours ago
    const record = {
      validity: new Date(now - 1 * 60 * 60 * 1000).toISOString() // Expired 1 hour ago
    }

    const result = shouldRepublish(record, created)
    expect(result).to.be.true()
  })

  it('should work with string date format from IPNS record', () => {
    const shouldRepublish = (name as any).shouldRepublish.bind(name)

    const now = Date.now()
    const created = new Date(now - 12 * 60 * 60 * 1000) // 12 hours ago
    const record = {
      validity: new Date(now + 12 * 60 * 60 * 1000).toISOString() // 12 hours from now (within threshold)
    }

    const result = shouldRepublish(record, created)
    expect(result).to.be.true()
  })

  it('should handle boundary conditions around 24 hour threshold', () => {
    const shouldRepublish = (name as any).shouldRepublish.bind(name)

    const now = Date.now()

    // Test just under threshold (should not republish)
    const createdJustUnder = new Date(now - 23 * 60 * 60 * 1000) // 23 hours ago
    const recordJustUnder = {
      validity: new Date(now + 25 * 60 * 60 * 1000).toISOString() // Valid for 25 more hours
    }
    expect(shouldRepublish(recordJustUnder, createdJustUnder)).to.be.false()

    // Test just over threshold (should republish)
    const createdJustOver = new Date(now - 25 * 60 * 60 * 1000) // 25 hours ago
    const recordJustOver = {
      validity: new Date(now + 25 * 60 * 60 * 1000).toISOString() // Valid for 25 more hours
    }
    expect(shouldRepublish(recordJustOver, createdJustOver)).to.be.true()
  })

  it('should return true for already expired records', () => {
    const shouldRepublish = (name as any).shouldRepublish.bind(name)

    const now = Date.now()
    const created = new Date(now - 6 * 60 * 60 * 1000) // 6 hours ago (DHT still valid)
    const record = {
      validity: new Date(now - 3 * 60 * 60 * 1000).toISOString() // Expired 3 hours ago (recordExpiry - now is negative)
    }

    const result = shouldRepublish(record, created)
    expect(result).to.be.true()
  })

  it('should return true for records that expired long ago', () => {
    const shouldRepublish = (name as any).shouldRepublish.bind(name)

    const now = Date.now()
    const created = new Date(now - 12 * 60 * 60 * 1000) // 12 hours ago (DHT still valid)
    const record = {
      validity: new Date(now - 48 * 60 * 60 * 1000).toISOString() // Expired 48 hours ago (very negative value)
    }

    const result = shouldRepublish(record, created)
    expect(result).to.be.true()
  })
})
