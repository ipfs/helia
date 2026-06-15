import { CID } from 'multiformats/cid'

export function isCID (obj?: any): obj is CID {
  if (obj == null) {
    return false
  }

  return CID.asCID(obj) != null
}
