import { expect } from 'aegir/chai'
import { toMtime } from '../../src/utils/to-mtime.js'

describe('to-mtime', () => {
  it('should survive undefined', async function () {
    const result = toMtime()

    expect(result).to.equal(undefined)
  })

  it('should convert a date', async function () {
    const input = new Date()
    const result = toMtime(input)

    expect(result?.secs).to.equal(BigInt(Math.floor(input.getTime() / 1000)))
  })

  it('should convert a timespec', async function () {
    const input = {
      Seconds: 100
    }
    const result = toMtime(input)

    expect(result?.secs).to.equal(BigInt(input.Seconds))
    expect(result?.nsecs).to.be.undefined()
  })

  it('should convert a timespec with fractional nanoseconds', async function () {
    const input = {
      Seconds: 100,
      FractionalNanoseconds: 5
    }
    const result = toMtime(input)

    expect(result?.secs).to.equal(BigInt(input.Seconds))
    expect(result?.nsecs).to.equal(input.FractionalNanoseconds)
  })

  it('should convert a mtime', async function () {
    const input = {
      secs: 100n
    }
    const result = toMtime(input)

    expect(result?.secs).to.equal(input.secs)
    expect(result?.nsecs).to.be.undefined()
  })

  it('should convert a mtime with fractional nanoseconds', async function () {
    const input = {
      secs: 100n,
      nsecs: 5
    }
    const result = toMtime(input)

    expect(result?.secs).to.equal(input.secs)
    expect(result?.nsecs).to.equal(input.nsecs)
  })
})
