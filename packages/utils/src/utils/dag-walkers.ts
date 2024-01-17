/* eslint max-depth: ["error", 7] */

import * as dagCbor from '@ipld/dag-cbor'
import * as dagJson from '@ipld/dag-json'
import * as dagPb from '@ipld/dag-pb'
import * as cborg from 'cborg'
import { Type, Token } from 'cborg'
import * as cborgJson from 'cborg/json'
import { CID } from 'multiformats'
import { base64 } from 'multiformats/bases/base64'
import * as json from 'multiformats/codecs/json'
import * as raw from 'multiformats/codecs/raw'
import type { DAGWalker } from '@helia/interface'

/**
 * Dag walker for dag-pb CIDs
 */
export const dagPbWalker: DAGWalker = {
  codec: dagPb.code,
  * walk (block) {
    const node = dagPb.decode(block)

    yield * node.Links.map(l => l.Hash)
  }
}

/**
 * Dag walker for raw CIDs
 */
export const rawWalker: DAGWalker = {
  codec: raw.code,
  * walk () {
    // no embedded CIDs in a raw block
  }
}

// https://github.com/ipfs/go-ipfs/issues/3570#issuecomment-273931692
const CID_TAG = 42

/**
 * Dag walker for dag-cbor CIDs. Does not actually use dag-cbor since
 * all we are interested in is extracting the the CIDs from the block
 * so we can just use cborg for that.
 */
export const dagCborWalker: DAGWalker = {
  codec: dagCbor.code,
  * walk (block) {
    const cids: CID[] = []
    const tags: cborg.TagDecoder[] = []
    tags[CID_TAG] = (bytes) => {
      if (bytes[0] !== 0) {
        throw new Error('Invalid CID for CBOR tag 42; expected leading 0x00')
      }

      const cid = CID.decode(bytes.subarray(1)) // ignore leading 0x00

      cids.push(cid)

      return cid
    }

    cborg.decode(block, {
      tags
    })

    yield * cids
  }
}

/**
 * Borrowed from @ipld/dag-json
 */
class DagJsonTokenizer extends cborgJson.Tokenizer {
  private readonly tokenBuffer: cborg.Token[]

  constructor (data: Uint8Array, options?: cborg.DecodeOptions) {
    super(data, options)

    this.tokenBuffer = []
  }

  done (): boolean {
    return this.tokenBuffer.length === 0 && super.done()
  }

  _next (): cborg.Token {
    if (this.tokenBuffer.length > 0) {
      // @ts-expect-error https://github.com/Microsoft/TypeScript/issues/30406
      return this.tokenBuffer.pop()
    }
    return super.next()
  }

  /**
   * Implements rules outlined in https://github.com/ipld/specs/pull/356
   */
  next (): cborg.Token {
    const token = this._next()

    if (token.type === Type.map) {
      const keyToken = this._next()
      if (keyToken.type === Type.string && keyToken.value === '/') {
        const valueToken = this._next()
        if (valueToken.type === Type.string) { // *must* be a CID
          const breakToken = this._next() // swallow the end-of-map token
          if (breakToken.type !== Type.break) {
            throw new Error('Invalid encoded CID form')
          }
          this.tokenBuffer.push(valueToken) // CID.parse will pick this up after our tag token
          return new Token(Type.tag, 42, 0)
        }
        if (valueToken.type === Type.map) {
          const innerKeyToken = this._next()
          if (innerKeyToken.type === Type.string && innerKeyToken.value === 'bytes') {
            const innerValueToken = this._next()
            if (innerValueToken.type === Type.string) { // *must* be Bytes
              for (let i = 0; i < 2; i++) {
                const breakToken = this._next() // swallow two end-of-map tokens
                if (breakToken.type !== Type.break) {
                  throw new Error('Invalid encoded Bytes form')
                }
              }
              const bytes = base64.decode(`m${innerValueToken.value}`)
              return new Token(Type.bytes, bytes, innerValueToken.value.length)
            }
            this.tokenBuffer.push(innerValueToken) // bail
          }
          this.tokenBuffer.push(innerKeyToken) // bail
        }
        this.tokenBuffer.push(valueToken) // bail
      }
      this.tokenBuffer.push(keyToken) // bail
    }
    return token
  }
}

/**
 * Dag walker for dag-json CIDs. Does not actually use dag-json since
 * all we are interested in is extracting the the CIDs from the block
 * so we can just use cborg/json for that.
 */
export const dagJsonWalker: DAGWalker = {
  codec: dagJson.code,
  * walk (block) {
    const cids: CID[] = []
    const tags: cborg.TagDecoder[] = []
    tags[CID_TAG] = (string) => {
      const cid = CID.parse(string)

      cids.push(cid)

      return cid
    }

    cborgJson.decode(block, {
      tags,
      tokenizer: new DagJsonTokenizer(block, {
        tags,
        allowIndefinite: true,
        allowUndefined: true,
        allowNaN: true,
        allowInfinity: true,
        allowBigInt: true,
        strict: false,
        rejectDuplicateMapKeys: false
      })
    })

    yield * cids
  }
}

/**
 * Dag walker for json CIDs. JSON has no facility for linking to
 * external blocks so the walker is a no-op.
 */
export const jsonWalker: DAGWalker = {
  codec: json.code,
  * walk () {}
}

export function defaultDagWalkers (walkers: DAGWalker[] = []): Record<number, DAGWalker> {
  const output: Record<number, DAGWalker> = {}

  ;[
    dagPbWalker,
    rawWalker,
    dagCborWalker,
    dagJsonWalker,
    jsonWalker,
    ...walkers
  ].forEach(dagWalker => {
    output[dagWalker.codec] = dagWalker
  })

  return output
}
