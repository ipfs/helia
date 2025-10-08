import { InvalidCodecError } from '@helia/interface'
import toBuffer from 'it-to-buffer'
import { CID } from 'multiformats/cid'
import * as jsonCodec from 'multiformats/codecs/json'
import { sha256 } from 'multiformats/hashes/sha2'
import type { AddOptions, GetOptions, JSONComponents, JSON as JSONInterface } from './index.js'

export class JSON implements JSONInterface {
  private readonly components: JSONComponents

  constructor (components: JSONComponents) {
    this.components = components
  }

  async add (obj: any, options: AddOptions = {}): Promise<CID> {
    const buf = jsonCodec.encode(obj)
    const hash = await (options.hasher ?? sha256).digest(buf)
    const cid = CID.createV1(jsonCodec.code, hash)

    await this.components.blockstore.put(cid, buf, options)

    return cid
  }

  async get <T> (cid: CID, options: GetOptions = {}): Promise<T> {
    if (cid.code !== jsonCodec.code) {
      throw new InvalidCodecError('The passed CID had an incorrect codec, it may correspond to a non-JSON block')
    }

    const buf = await toBuffer(this.components.blockstore.get(cid, options))

    return jsonCodec.decode(buf)
  }
}
