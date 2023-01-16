import os from 'node:os'
import path from 'node:path'

export function findHeliaDir (): string {
  if (process.env.XDG_DATA_HOME != null) {
    return process.env.XDG_DATA_HOME
  }

  const platform = os.platform()

  if (platform === 'darwin') {
    return path.join(`${process.env.HOME}`, 'Library', 'helia')
  }

  return path.join(`${process.env.HOME}`, '.helia')
}
