import { InvalidCodecError } from '@helia/interface'
import toBuffer from 'it-to-buffer'
import { CID } from 'multiformats/cid'
import * as raw from 'multiformats/codecs/raw'
import { sha256 } from 'multiformats/hashes/sha2'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import type { AddOptions, GetOptions, StringsComponents, Strings as StringsInterface } from './index.js'

export class Strings implements StringsInterface {
  private readonly components: StringsComponents

  constructor (components: StringsComponents) {
    this.components = components
  }

  async add (string: string, options: AddOptions = {}): Promise<CID> {
    const buf = uint8ArrayFromString(string)
    const hash = await (options.hasher ?? sha256).digest(buf)
    const cid = CID.createV1(raw.code, hash)

    await this.components.blockstore.put(cid, buf, options)

    return cid
  }

  async get (cid: CID, options: GetOptions = {}): Promise<string> {
    // allow raw, JSON and DAG-JSON - the user can drop down to the blockstore
    // API if they need anything else
    if (cid.code !== raw.code && cid.code !== 0x0129 && cid.code !== 0x0200) {
      throw new InvalidCodecError('The passed CID had an incorrect codec, it may correspond to a block data that cannot be interpreted as a string')
    }

    const buf = await toBuffer(this.components.blockstore.get(cid, options))

    return uint8ArrayToString(buf)
  }
}
