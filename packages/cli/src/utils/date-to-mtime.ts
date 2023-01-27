import type { Mtime } from 'ipfs-unixfs'

export function dateToMtime (date: Date): Mtime {
  const ms = date.getTime()
  const secs = Math.floor(ms / 1000)

  return {
    secs,
    nsecs: (ms - (secs * 1000)) * 1000
  }
}
