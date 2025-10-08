import { InvalidCodecError } from '@helia/interface'
import * as codec from '@ipld/dag-json'
import toBuffer from 'it-to-buffer'
import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import type { AddOptions, DAGJSONComponents, DAGJSON as DAGJSONInterface, GetOptions } from './index.js'

export class DAGJSON implements DAGJSONInterface {
  private readonly components: DAGJSONComponents

  constructor (components: DAGJSONComponents) {
    this.components = components
  }

  async add (obj: any, options: AddOptions = {}): Promise<CID> {
    const buf = codec.encode(obj)
    const hash = await (options.hasher ?? sha256).digest(buf)
    const cid = CID.createV1(codec.code, hash)

    await this.components.blockstore.put(cid, buf, options)

    return cid
  }

  async get <T> (cid: CID, options: GetOptions = {}): Promise<T> {
    if (cid.code !== codec.code) {
      throw new InvalidCodecError('The passed CID had an incorrect codec, it may correspond to a non-DAG-JSON block')
    }

    const buf = await toBuffer(this.components.blockstore.get(cid, options))

    return codec.decode(buf)
  }
}
