import * as dagCbor from '@ipld/dag-cbor'
import * as dagJson from '@ipld/dag-json'
import * as dagPb from '@ipld/dag-pb'
import { CID } from 'multiformats/cid'
import * as json from 'multiformats/codecs/json'
import * as raw from 'multiformats/codecs/raw'

// 112 = dag-pb, 18 = sha256, 0 = CIDv0
const mh = CID.parse<string, Uint8Array, 112, 18, 0>('QmQJ8fxavY54CUsxMSx9aE9Rdcmvhx8awJK2jzJp4iAqCr').multihash

export const cids: Record<string, CID> = {
  filev0: CID.createV0(mh),
  file: CID.createV1(dagPb.code, mh),
  dagCbor: CID.createV1(dagCbor.code, mh),
  dagJson: CID.createV1(dagJson.code, mh),
  json: CID.createV1(json.code, mh),
  raw: CID.createV1(raw.code, mh)
}
