/**
 * @packageDocumentation
 *
 * `@helia/strings` makes working with strings {@link https://github.com/ipfs/helia Helia} simple & straightforward.
 *
 * See the {@link Strings Strings interface} for all available operations.
 *
 * @example
 *
 * ```typescript
 * import { createHelia } from 'helia'
 * import { strings } from '@helia/strings'
 * import { CID } from 'multiformats/cid'
 *
 * const str = strings(helia)
 * const cid = await str.put('hello world')
 * const string = await str.get(cid)
 *
 * console.info(string)
 * // hello world
 * ```
 */

import { CID } from 'multiformats/cid'
import type { Blocks, GetBlockProgressEvents, PutBlockProgressEvents } from '@helia/interface/blocks'
import type { AbortOptions } from '@libp2p/interfaces'
import type { ProgressOptions } from 'progress-events'
import { sha256 } from 'multiformats/hashes/sha2'
import * as raw from 'multiformats/codecs/raw'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import type { BlockCodec } from 'multiformats/codecs/interface'
import type { MultihashHasher } from 'multiformats/hashes/interface'

export interface StringsComponents {
  blockstore: Blocks
}

export interface AddOptions extends AbortOptions, ProgressOptions<PutBlockProgressEvents> {
  hasher: MultihashHasher
  codec: BlockCodec<any, unknown>
}

export interface GetOptions extends AbortOptions, ProgressOptions<GetBlockProgressEvents> {
  codec: BlockCodec<any, unknown>
}

/**
 * The UnixFS interface provides familiar filesystem operations to make working with
 * UnixFS DAGs simple and intuitive.
 */
export interface Strings {
  /**
   * Add a string to your Helia node and get a CID that refers to the block the
   * string has been stored as.
   *
   * @example
   *
   * ```typescript
   * import { strings } from '@helia/strings'
   *
   * const str = strings(helia)
   * const cid = await str.add('hello world')
   *
   * console.info(cid)
   * // CID(QmFoo)
   * ```
   */
  add: (str: string, options?: Partial<AddOptions>) => Promise<CID>

  /**
   * Get a string from your Helia node, either previously added to it or to
   * another node on the network.
   *
   * @example
   *
   * ```typescript
   * import { strings } from '@helia/strings'
   * import { CID } from 'multiformats/cid'
   *
   * const str = strings(helia)
   * const cid = CID.parse('')
   * const string = await str.get(cid)
   *
   * console.info(string)
   * // hello world
   * ```
   */
  get: (cid: CID, options?: Partial<GetOptions>) => Promise<string>
}

class DefaultStrings implements Strings {
  private readonly components: StringsComponents

  constructor (components: StringsComponents) {
    this.components = components
  }

  async add (string: string, options: Partial<AddOptions> = {}): Promise<CID> {
    const buf = uint8ArrayFromString(string)
    const hash = await (options.hasher ?? sha256).digest(buf)
    const codec = options.codec ?? raw
    const cid = CID.createV1(codec.code, hash)

    await this.components.blockstore.put(cid, buf, options)

    return cid
  }

  async get (cid: CID, options: Partial<GetOptions> = {}): Promise<string> {
    const buf = await this.components.blockstore.get(cid, options)

    return uint8ArrayToString(buf)
  }
}

/**
 * Create a {@link Strings} instance for use with {@link https://github.com/ipfs/helia Helia}
 */
export function strings (helia: { blockstore: Blocks }): Strings {
  return new DefaultStrings(helia)
}
