import type { Mtime, MtimeLike } from 'ipfs-unixfs'

export function toMtime (mtimeLike: MtimeLike): Mtime
export function toMtime (mtimeLike?: MtimeLike): Mtime | undefined
export function toMtime (mtimeLike?: MtimeLike): Mtime | undefined {
  if (mtimeLike == null) {
    return undefined
  }

  if (isMtime(mtimeLike)) {
    return mtimeLike
  }

  if (mtimeLike instanceof Date) {
    return dateToTimespec(mtimeLike)
  }

  if (Array.isArray(mtimeLike)) {
    const output: Mtime = {
      secs: BigInt(mtimeLike[0])
    }

    if (mtimeLike.length > 1) {
      output.nsecs = mtimeLike[1]
    }

    return output
  }

  if (typeof mtimeLike.Seconds === 'number') {
    const output: Mtime = {
      secs: BigInt(mtimeLike.Seconds)
    }

    if (mtimeLike.FractionalNanoseconds != null) {
      output.nsecs = mtimeLike.FractionalNanoseconds
    }

    return output
  }

  throw new Error('Cannot convert object to mtime')
}

function dateToTimespec (date: Date): Mtime {
  const ms = date.getTime()
  const secs = Math.floor(ms / 1000)

  return {
    secs: BigInt(secs),
    nsecs: (ms - (secs * 1000)) * 1000
  }
}

function isMtime (obj: any): obj is Mtime {
  return typeof obj.secs === 'bigint'
}
